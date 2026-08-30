import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CustomerBillingRepository } from '../repository/customer-billing.repository';
import {
  GenerateCustomerBillDto,
  GetCustomerBillsQueryDto,
} from '../dto/customer-billing.dto';
import { NotificationService } from 'src/notifications/notification.service';
import { AuthService } from 'src/panels/admin/auth/auth.service';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';
import { CronLockService } from 'src/shared/scheduling/cron-lock.service';

@Injectable()
export class CustomerBillingService {
  private readonly logger = new Logger(CustomerBillingService.name);

  constructor(
    private readonly repository: CustomerBillingRepository,
    private readonly notificationService: NotificationService,
    private readonly authServices: AuthService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly cronLock: CronLockService,
  ) { }

  /**
   * Automated monthly cron job: runs at 12:05 AM on the 1st day of every month (@Cron('0 5 0 1 * *'))
   */
  @Cron('0 5 0 1 * *')
  async handleMonthlyCron() {
    // Only one instance may run this tick — see CronLockService.
    if (!(await this.cronLock.acquire('handleMonthlyCron', 3600))) return;

    this.logger.log('Executing automated monthly cron job for postpaid bills (@Cron 0 5 0 1 * *)...');
    try {
      const res = await this.runMonthlyBatchBilling({});
      this.logger.log(`Cron job finished successfully: ${JSON.stringify(res.summary)}`);
    } catch (err: any) {
      this.logger.error(`Error executing monthly cron job: ${err.message}`, err.stack);
    }
  }

  /**
   * Daily automated cron job at 9:00 AM (@Cron('0 9 * * *'))
   * Sends 7-day, 3-day, and 1-day gentle postpaid due push notifications to customer app via Firebase
   */
  @Cron('0 9 * * *')
  async handlePostpaidRemindersCron() {
    // Only one instance may run this tick — see CronLockService.
    if (!(await this.cronLock.acquire('handlePostpaidRemindersCron', 3600))) return;

    this.logger.log('Executing daily 9 AM cron for Postpaid Bill Push Notification Reminders (7D, 3D, 1D)...');
    try {
      const pendingBills = await this.repository.findPendingPostpaidBills();
      if (!pendingBills || pendingBills.length === 0) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const bill of pendingBills) {
        if (!bill.due_date || !bill.customer_id) continue;
        const due = new Date(bill.due_date);
        due.setHours(0, 0, 0, 0);

        const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 3600 * 24));
        const amountStr = `₹${Number(bill.due_amount || bill.total_amount || 0).toFixed(2)}`;

        if (diffDays === 7) {
          await this.pushNotificationService.sendNotificationToUsers(
            [bill.customer_id],
            {
              title: '🔔 F2H Postpaid Bill Due in 7 Days',
              body: `Gentle Reminder: Your postpaid bill #${bill.bill_number} of ${amountStr} is due on ${due.toLocaleDateString('en-IN')}. Pay via F2H App for uninterrupted service.`,
            },
          ).catch(() => {});
          this.logger.log(`Sent 7-day postpaid reminder FCM push to customer ${bill.customer_id}`);
        } else if (diffDays === 3) {
          await this.pushNotificationService.sendNotificationToUsers(
            [bill.customer_id],
            {
              title: '⏰ F2H Postpaid Bill Due in 3 Days',
              body: `Reminder: Your bill #${bill.bill_number} of ${amountStr} is due in 3 days. Pay now via F2H App.`,
            },
          ).catch(() => {});
          this.logger.log(`Sent 3-day postpaid reminder FCM push to customer ${bill.customer_id}`);
        } else if (diffDays === 1) {
          await this.pushNotificationService.sendNotificationToUsers(
            [bill.customer_id],
            {
              title: '🚨 Final Alert: Postpaid Bill Due Tomorrow',
              body: `Urgent: Postpaid bill #${bill.bill_number} of ${amountStr} is due tomorrow! Settle now to maintain active subscription deliveries.`,
            },
          ).catch(() => {});
          this.logger.log(`Sent 1-day postpaid reminder FCM push to customer ${bill.customer_id}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Error sending postpaid push notification reminders: ${err.message}`, err.stack);
    }
  }

  /**
   * Main feature: Generate Postpaid Bill for single or all eligible customers
   */
  async generateBill(dto: GenerateCustomerBillDto): Promise<any> {
    return await this.runMonthlyBatchBilling(dto || {});
  }

  /**
   * Unified batch/single billing engine
   */
  async runMonthlyBatchBilling(dto: GenerateCustomerBillDto): Promise<any> {
    let periodStart = dto?.periodStart;
    let periodEnd = dto?.periodEnd;
    let dueDate = dto?.dueDate;

    if (!periodStart || !periodEnd || !dueDate) {
      const now = new Date();
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevYear = prevMonthDate.getFullYear();
      const prevMonth = prevMonthDate.getMonth();

      const startDay = new Date(prevYear, prevMonth, 1);
      const endDay = new Date(prevYear, prevMonth + 1, 0);
      const dueDay = new Date(now.getFullYear(), now.getMonth(), 5);

      const formatYYMMDD = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      periodStart = periodStart || formatYYMMDD(startDay);
      periodEnd = periodEnd || formatYYMMDD(endDay);
      dueDate = dueDate || formatYYMMDD(dueDay);
    }

    let targetCustomers: any[] = [];
    const isSingleCustomer = Boolean(dto?.customerId && dto.customerId.trim() !== '' && dto.customerId !== 'ALL');

    if (isSingleCustomer) {
      targetCustomers = [{ customer_id: dto.customerId!.trim() }];
    } else {
      const eligible = await this.repository.findEligiblePostpaidCustomers();
      targetCustomers = eligible || [];
    }

    let generated = 0;
    let skipped = 0;
    let failed = 0;
    const results: any[] = [];

    for (const c of targetCustomers) {
      const cid = c.customer_id;
      try {
        const enabledCheck = await this.repository.checkCustomerPostpaidEnabled(cid);
        if (!enabledCheck) {
          failed++;
          results.push({
            status: false,
            action: 'failed',
            customerId: cid,
            message: `Customer ${cid} not found or postpaid billing is not enabled.`,
          });
          continue;
        }

        const res = await this.processSingleCustomerBill(cid, periodStart, periodEnd, dueDate);
        if (res.action === 'generated') {
          generated++;
        } else if (res.action === 'skipped') {
          skipped++;
        } else {
          failed++;
        }
        results.push(res);
      } catch (err: any) {
        this.logger.error(`Error generating bill for customer ${cid}: ${err.message}`, err.stack);
        failed++;
        results.push({
          status: false,
          action: 'failed',
          customerId: cid,
          message: err.message || 'Error occurred during bill processing.',
        });
      }
    }

    const summary = {
      eligibleCustomers: targetCustomers.length,
      generated,
      skipped,
      failed,
    };

    if (generated > 0) {
      setImmediate(async () => {
        try {
          const adminUsersRes = await this.authServices.getUsersByRole('ADMIN');
          const adminUserIds = adminUsersRes.user_ids || [];

          if (adminUserIds.length > 0) {
            await this.notificationService.sendNotification({
              title: isSingleCustomer ? '🧾 Postpaid Bill Generated' : '🧾 Monthly Bills Generated',
              message: isSingleCustomer
                ? `Generated 1 new postpaid bill for customer ${targetCustomers[0].customer_id}`
                : `Successfully generated ${generated} postpaid bills for ${periodStart} to ${periodEnd}`,
              type: 'info',
              priority: 'high',
              recipientIds: adminUserIds,
              senderId: 'system',
            });
          }
        } catch (err) {
          this.logger.error('Failed to send bill generation notification', err);
        }
      });
    }

    if (isSingleCustomer && results.length > 0) {
      return {
        ...results[0],
        billingPeriod: { start: periodStart, end: periodEnd },
        dueDate,
        summary,
        data: results,
      };
    }

    return {
      status: true,
      isBatch: !isSingleCustomer,
      message: 'Postpaid bill generation completed.',
      billingPeriod: { start: periodStart, end: periodEnd },
      dueDate,
      summary,
      data: results,
    };
  }

  /**
   * Simulation / Developer Testing: Preview Postpaid Bill Calculations without database writes
   */
  async previewMonthlyBatchBilling(dto: GenerateCustomerBillDto): Promise<any> {
    let periodStart = dto?.periodStart;
    let periodEnd = dto?.periodEnd;
    let dueDate = dto?.dueDate;

    if (!periodStart || !periodEnd || !dueDate) {
      const now = new Date();
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevYear = prevMonthDate.getFullYear();
      const prevMonth = prevMonthDate.getMonth();

      const startDay = new Date(prevYear, prevMonth, 1);
      const endDay = new Date(prevYear, prevMonth + 1, 0);
      const dueDay = new Date(now.getFullYear(), now.getMonth(), 5);

      const formatYYMMDD = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      periodStart = periodStart || formatYYMMDD(startDay);
      periodEnd = periodEnd || formatYYMMDD(endDay);
      dueDate = dueDate || formatYYMMDD(dueDay);
    }

    let targetCustomers: any[] = [];
    const isSingleCustomer = Boolean(dto?.customerId && dto.customerId.trim() !== '' && dto.customerId !== 'ALL');

    if (isSingleCustomer) {
      targetCustomers = [{ customer_id: dto.customerId!.trim() }];
    } else {
      const eligible = await this.repository.findEligiblePostpaidCustomers();
      targetCustomers = eligible || [];
    }

    const candidates: any[] = [];
    const skipped: any[] = [];
    let totalSimulatedAmount = 0;

    for (const c of targetCustomers) {
      const cid = c.customer_id;
      try {
        const custInfo = await this.repository.checkCustomerPostpaidEnabled(cid);
        const nameParts = [custInfo?.first_name || c.first_name, custInfo?.last_name || c.last_name].filter(Boolean);
        const customerName = nameParts.length > 0 ? nameParts.join(' ') : 'Customer';
        const customerPhone = custInfo?.phone || c.phone || '';

        const existingBill = await this.repository.checkBillExists(cid, periodStart, periodEnd);
        if (existingBill) {
          skipped.push({
            customer_id: cid,
            customer_name: customerName,
            customer_phone: customerPhone,
            reason: `Bill #${existingBill.bill_number} already exists (${existingBill.status}, ₹${existingBill.total_amount})`,
          });
          continue;
        }

        const deliveredOrders = await this.repository.findDeliveredOrdersForPeriod(cid, periodStart, periodEnd, true);
        if (!deliveredOrders || deliveredOrders.length === 0) {
          skipped.push({
            customer_id: cid,
            customer_name: customerName,
            customer_phone: customerPhone,
            reason: 'No delivered orders found in this billing period',
          });
          continue;
        }

        let totalAmt = 0;
        let paidAmt = 0;
        for (const ord of deliveredOrders) {
          const amt = Number(ord.total_amount || 0);
          totalAmt += amt;
          if (ord.order_source === 'one-time' && ord.payment_status === 'paid') {
            paidAmt += amt;
          }
        }

        totalSimulatedAmount += totalAmt;

        // Group delivered orders by subscription or one-time
        const subsMap = new Map<string, any>();
        for (const ord of deliveredOrders) {
          const subKey = ord.subscription_id || 'ONETIME';
          if (!subsMap.has(subKey)) {
            subsMap.set(subKey, {
              subscription_id: ord.subscription_id || null,
              is_subscription: Boolean(ord.subscription_id),
              title: ord.subscription_id ? `Subscription ${ord.subscription_id}` : 'One-Time Orders',
              total_amount: 0,
              items_count: 0,
              orders: [],
            });
          }
          const subGroup = subsMap.get(subKey);
          subGroup.total_amount = Math.round((subGroup.total_amount + Number(ord.total_amount || 0)) * 100) / 100;
          subGroup.items_count++;
          subGroup.orders.push({
            order_id: ord.order_id,
            scheduled_date: ord.scheduled_date,
            total_amount: Number(ord.total_amount || 0),
            order_name: ord.order_name,
            order_source: ord.order_source,
            status: ord.status,
          });
        }

        candidates.push({
          customer_id: cid,
          customer_name: customerName,
          customer_phone: customerPhone,
          orders_count: deliveredOrders.length,
          total_amount: Math.round(totalAmt * 100) / 100,
          paid_amount: Math.round(paidAmt * 100) / 100,
          due_amount: Math.round((totalAmt - paidAmt) * 100) / 100,
          simulated_bill_id: `SIM_BILL_${cid}_${periodStart.replace(/-/g, '')}`,
          subscriptions: Array.from(subsMap.values()),
          orders: deliveredOrders.map((o) => ({
            order_id: o.order_id,
            subscription_id: o.subscription_id,
            scheduled_date: o.scheduled_date,
            total_amount: Number(o.total_amount || 0),
            order_name: o.order_name,
            order_source: o.order_source,
            status: o.status,
          })),
        });
      } catch (err: any) {
        skipped.push({
          customer_id: cid,
          reason: err.message || 'Error checking customer',
        });
      }
    }

    return {
      status: true,
      data: {
        billingPeriod: { start: periodStart, end: periodEnd },
        dueDate,
        totalEligibleCustomers: targetCustomers.length,
        totalCalculatedBills: candidates.length,
        totalSkipped: skipped.length,
        totalSimulatedAmount: Math.round(totalSimulatedAmount * 100) / 100,
        candidates,
        skipped,
      },
    };
  }

  private async processSingleCustomerBill(
    customerId: string,
    periodStart: string,
    periodEnd: string,
    dueDate: string,
  ): Promise<any> {
    const customer = await this.repository.checkCustomerPostpaidEnabled(customerId);
    const isPostpaid = customer ? Boolean(customer.is_postpaid_enabled) : true;

    const deliveredOrders = await this.repository.findDeliveredOrdersForPeriod(
      customerId,
      periodStart,
      periodEnd,
      isPostpaid,
    );

    const existingBill = await this.repository.checkBillExists(
      customerId,
      periodStart,
      periodEnd,
    );
    if (existingBill) {
      return {
        status: false,
        action: 'skipped',
        message: 'Bill already exists for this customer and billing period.',
        billNumber: existingBill.bill_number,
        'Bill Number': existingBill.bill_number,
        customerId,
        'Customer ID': customerId,
        billingPeriod: { start: periodStart, end: periodEnd },
        'Billing Period': `${periodStart} to ${periodEnd}`,
        totalAmount: Number(existingBill.total_amount || 0),
        'Total Amount': Number(existingBill.total_amount || 0),
        billStatus: existingBill.status,
        'Bill Status': existingBill.status,
      };
    }

    if (!deliveredOrders || deliveredOrders.length === 0) {
      return {
        status: false,
        action: 'skipped',
        message: isPostpaid
          ? 'No delivered orders found for this customer within the given billing period.'
          : 'No scheduled orders found for this customer within the given billing period.',
        customerId,
        'Customer ID': customerId,
        deliveredOrdersCount: 0,
        'Number of Delivered Orders': 0,
      };
    }

    let totalAmount = 0;
    let paidAmount = 0;
    for (const ord of deliveredOrders) {
      const amt = Number(ord.total_amount || 0);
      totalAmount += amt;
      if (isPostpaid) {
        if (ord.order_source === 'one-time' && ord.payment_status === 'paid') {
          paidAmount += amt;
        }
      } else {
        paidAmount += amt;
      }
    }

    const status = paidAmount >= totalAmount ? 'paid' : 'pending';

    const createdBill = await this.repository.createBillTransaction(
      customerId,
      periodStart,
      periodEnd,
      dueDate,
      deliveredOrders,
      totalAmount,
      paidAmount,
      status,
      isPostpaid ? 'postpaid' : 'prepaid',
    );

    this.logger.log(`Successfully generated postpaid bill #${createdBill.bill_number} for ${customerId}`);

    setImmediate(async () => {
      try {
        const amountFormatted = `₹${Number(createdBill.total_amount || 0).toFixed(2)}`;
        const dueDateFormatted = new Date(dueDate).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
        });
        await this.pushNotificationService.sendNotificationToUsers(
          [customerId],
          {
            title: '🧾 Your Postpaid Bill is Ready',
            body: `Bill #${createdBill.bill_number} for ${amountFormatted} has been generated. Due by ${dueDateFormatted}.`,
          },
        );
        this.logger.log(`Push notification sent to customer ${customerId} for bill #${createdBill.bill_number}`);
      } catch (pushErr) {
        this.logger.error(`Failed to send push notification to customer ${customerId}`, pushErr);
      }
    });

    return {
      status: true,
      action: 'generated',
      message: 'Postpaid bill generated successfully.',
      billNumber: createdBill.bill_number,
      'Bill Number': createdBill.bill_number,
      customerId,
      'Customer ID': customerId,
      billingPeriod: { start: periodStart, end: periodEnd },
      'Billing Period': { start: periodStart, end: periodEnd },
      totalAmount: Number(createdBill.total_amount || 0),
      'Total Amount': Number(createdBill.total_amount || 0),
      deliveredOrdersCount: deliveredOrders.length,
      'Number of Delivered Orders': deliveredOrders.length,
      billStatus: createdBill.status,
      'Bill Status': createdBill.status,
    };
  }

  async getEligibleCustomers(): Promise<any> {
    const customers = await this.repository.findEligiblePostpaidCustomers();
    return {
      status: true,
      data: (customers || []).map((c: any) => ({
        customerId: c.customer_id,
        customerName: c.first_name || 'Customer',
        phone: c.phone || '',
      })),
    };
  }

  async getBills(query: GetCustomerBillsQueryDto): Promise<any> {
    const { bills, total } = await this.repository.findBills(query);
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      status: true,
      data: bills.map((b: any) => {
        const totalAmount = Number(b.total_amount || 0);
        const paidAmount = Number(b.paid_amount || 0);
        const balanceAmount = Number(b.due_amount || 0);
        const status = b.status;

        return {
          id: b.id,
          billNumber: b.bill_number,
          customerId: b.customer_id,
          customerName: b.customer_name || 'Customer',
          billingPeriod: {
            start: b.period_start,
            end: b.period_end,
          },
          dueDate: b.due_date,
          totalAmount,
          paidAmount,
          balanceAmount,
          status,
          orderCount: Number(b.order_count || 0),
          is_postpaid_enabled: b.is_postpaid_enabled !== false,
          createdAt: b.created_at,
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async getBillById(id: string): Promise<any> {
    const bill = await this.repository.findBillById(id);
    if (!bill) {
      throw new NotFoundException(`Postpaid bill ${id} not found.`);
    }

    const totalAmount = Number(bill.total_amount || 0);
    const paidAmount = Number(bill.paid_amount || 0);
    const balanceAmount = Number(bill.due_amount || 0);
    const status = bill.status;

    return {
      status: true,
      data: {
        id: bill.id,
        billNumber: bill.bill_number,
        customerId: bill.customer_id,
        customerName: bill.customer_name || 'Customer',
        customerPhone: bill.customer_phone || '',
        billingPeriod: {
          start: bill.period_start,
          end: bill.period_end,
        },
        dueDate: bill.due_date,
        totalAmount,
        paidAmount,
        balanceAmount,
        status,
        ordersIncluded: bill.ordersIncluded || [],
        createdAt: bill.created_at,
      },
    };
  }

  async payBill(id: string, amount: number, paymentMode?: string, referenceNumber?: string, notes?: string): Promise<any> {
    const bill = await this.repository.findBillById(id);
    if (!bill) {
      throw new NotFoundException(`Postpaid bill ${id} not found.`);
    }

    if (bill.status === 'paid') {
      return { status: false, message: 'This bill is already fully paid.' };
    }

    const payAmt = Number(amount || 0);
    if (payAmt <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero.');
    }

    const currentPaid = Number(bill.paid_amount || 0);
    const totalAmt = Number(bill.total_amount || 0);
    const newPaid = Math.min(totalAmt, currentPaid + payAmt);
    let newStatus = 'partial';
    if (newPaid >= totalAmt) {
      newStatus = 'paid';
    }

    const updated = await this.repository.updateBillPayment(bill.id, newPaid, newStatus);
    return {
      status: true,
      message: 'Payment recorded successfully.',
      data: updated,
    };
  }
}