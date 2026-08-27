import { BadRequestException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import {
  CreateSubscriptionDto,
  SubscriptionItemDto,
} from '../dto/subscription.dto';

import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';
import { NotificationService } from 'src/notifications/notification.service';
import { MailService } from 'src/mail/mail.service';
import { CustomerPaymentService } from '../../payment/payment.service';

const DEFAULT_BRANCH_ID = 'ALL';
const DEFAULT_ADDRESS_ID = 'ADDR_DEFAULT';

function calcMonthEndDate(startDate?: string): string {
  if (!startDate) return '';
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return startDate;
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  const yyyy = lastDay.getUTCFullYear();
  const mm = String(lastDay.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(lastDay.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly data: DataService,
    private readonly developer: DeveloperService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly notificationService: NotificationService,
    private readonly mailService: MailService,
    private readonly customerPaymentService: CustomerPaymentService,
  ) { }

  async checkout(body: CreateSubscriptionDto, req?: any) {
    this.developer.debug('SubscriptionsService.checkout called', { body });

    let customerId = body.customer_id?.trim() || (req?.headers?.['x-user-id'] as string)?.trim() || (req?.user as any)?.user_id;
    if (!customerId && req?.headers?.['authorization']) {
      try {
        const token = (req.headers['authorization'] as string).replace(/^Bearer\s+/i, '');
        const jwt = require('jsonwebtoken');
        const decoded: any = jwt.decode(token);
        if (decoded?.user_id || decoded?.sub) {
          customerId = decoded.user_id || decoded.sub;
        }
      } catch {
        // Deliberately tolerated: the caller has a valid fallback for this failure.
      }
    }

    if (customerId) {
      body.customer_id = customerId;
    }

    const estimatedTotal = Number(body.estimated_total || 0);

    if (!customerId) {
      this.developer.error('SubscriptionsService.checkout missing customer_id', { body });
      throw new BadRequestException('customer_id is required');
    }



    const email = (req as any)?.user?.email;
    const custQuery = `
      SELECT
        c.customer_id,
        c.wallet_balance,
        c.is_postpaid_enabled,
        c.postpaid_credit_limit,
        c.branch_id,
        u.first_name,
        u.last_name,
        u.phone,
        u.email
      FROM customers c
      JOIN users u ON u.user_id = c.customer_id
      WHERE c.customer_id = $1 OR (u.email IS NOT NULL AND u.email = $2 AND u.email != '')
      LIMIT 1
    `;
    const custRows = await this.db.query(custQuery, [customerId, email || customerId]);
    let customer = custRows?.[0];

    if (!customer) {
      try {
        const userRes = await this.data.query('users', {
          where: [{ column: 'user_id', operator: '=', value: customerId }],
          limit: 1,
        });
        const userObj = userRes?.data?.[0];
        if (userObj) {
          const now = new Date();
          const activeBranchRes = await this.data.query('branches', {
            where: [{ column: 'is_active', operator: '=', value: true }],
            limit: 1,
          });
          const activeBranchId = activeBranchRes?.data?.[0]?.branch_id || 'BRANCH_KUPPAM_01';
          await this.data.insert('customers', {
            customer_id: customerId,
            branch_id: activeBranchId,
            wallet_balance: 0,
            is_postpaid_enabled: false,
            postpaid_credit_limit: 0,
            created_at: now,
            updated_at: now,
          });
          const reFetch = await this.db.query(custQuery, [customerId, email || customerId]);
          customer = reFetch?.[0];
        }
      } catch {
        // Deliberately tolerated: the caller has a valid fallback for this failure.
      }
    }
    if (!customer) {
      this.developer.error('SubscriptionsService.checkout customer profile not found', { customerId });
      throw new BadRequestException('Customer profile not found');
    }

    this.developer.debug('SubscriptionsService.checkout customer details fetched', {
      customerId,
      wallet_balance: customer.wallet_balance,
      is_postpaid_enabled: customer.is_postpaid_enabled,
      postpaid_credit_limit: customer.postpaid_credit_limit,
      estimatedTotal,
    });

    const paymentType = (body.payment_type || 'prepaid').toLowerCase();
    const paymentMethod = (body.payment_method || 'wallet').toLowerCase();
    const walletBalance = Number(customer.wallet_balance || 0);

    // 1b. Validate against outstanding unpaid bills in customer_bills table
    const unpaidBillsRes = await this.db.query(
      `SELECT COUNT(*)::int AS cnt, COALESCE(SUM(due_amount), 0) AS total_due
       FROM customer_bills
       WHERE customer_id = $1
         AND status IN ('unpaid', 'due', 'overdue')
         AND due_amount > 0`,
      [customerId],
    );
    const unpaidCount = Number(unpaidBillsRes?.[0]?.cnt || 0);
    const unpaidDue = Number(unpaidBillsRes?.[0]?.total_due || 0);

    if (unpaidCount > 0 && paymentType === 'postpaid') {
      return {
        status: false,
        error_code: 'outstanding_bills_exist',
        message: `You have ${unpaidCount} unpaid bill(s) totaling ₹${unpaidDue.toFixed(2)} in customer bills. Please clear outstanding bills before placing new postpaid subscriptions.`,
      };
    }

    // 2. PREPAID validation & payment gate
    let consumedOnlineTxn: any = null;
    if (paymentType === 'prepaid') {
      if (paymentMethod === 'wallet') {
        if (walletBalance < estimatedTotal) {
          this.developer.warn('SubscriptionsService.checkout insufficient wallet balance', {
            customerId,
            walletBalance,
            estimatedTotal,
          });
          return {
            status: false,
            error_code: 'insufficient_wallet',
            message: 'Insufficient wallet balance',
            wallet_balance: walletBalance,
            required: estimatedTotal,
          };
        }
      } else if (['online', 'upi', 'razorpay'].includes(paymentMethod)) {
        if (!body.razorpay_order_id) {
          return {
            status: false,
            error_code: 'missing_razorpay_order',
            message: 'razorpay_order_id is required for online subscription checkout.',
          };
        }
        consumedOnlineTxn = await this.customerPaymentService.consumeOrderPayment({
          customerId,
          razorpayOrderId: body.razorpay_order_id,
          razorpayPaymentId: body.razorpay_payment_id,
          razorpaySignature: body.razorpay_signature,
          expectedAmount: estimatedTotal,
          orderReference: 'SUBSCRIPTION_PENDING',
        });
      }
    }

    // 3. POSTPAID validation
    if (paymentType === 'postpaid') {
      const isPostpaidEnabled = Boolean(customer.is_postpaid_enabled === 't' || customer.is_postpaid_enabled === true || customer.is_postpaid_enabled === 'true');
      const creditLimit = Number(customer.postpaid_credit_limit || 0);

      if (!isPostpaidEnabled) {
        return {
          status: false,
          error_code: 'postpaid_not_enabled',
          message: 'Postpaid facility is not enabled on your account. Please select Prepaid option.',
        };
      }
      // Calculate monthly estimations of existing active/paused postpaid subscriptions directly from monthly_estimate column
      const existingSubsRes = await this.db.query(
        `SELECT
          COALESCE(SUM(monthly_estimate::numeric), 0) AS total_committed
        FROM subscriptions
        WHERE customer_id = $1
          AND payment_type = 'postpaid'
          AND LOWER(status) IN ('active', 'paused');`,
        [customerId],
      );

      const existingCommitted = Number(existingSubsRes?.[0]?.total_committed || 0);
      const newMonthlyEstimate = Number(body.monthly_estimate || estimatedTotal);

      this.developer.debug('SubscriptionsService.checkout postpaid credit check', {
        existingCommitted,
        newMonthlyEstimate,
        combinedTotal: existingCommitted + newMonthlyEstimate,
        creditLimit,
        willBlock: creditLimit > 0 && (existingCommitted + newMonthlyEstimate) > creditLimit,
      });

      const combinedTotal = existingCommitted + newMonthlyEstimate;
      if (creditLimit > 0 && combinedTotal > creditLimit) {
        return {
          status: false,
          error_code: 'credit_limit_exceeded',
          message: 'Postpaid credit limit exceeded. Please re-select Prepaid option.',
          credit_limit: creditLimit,
          existing_committed: existingCommitted,
          requested: newMonthlyEstimate,
        };
      }
    }

    // 4. Create subscription
    this.developer.debug('SubscriptionsService.checkout invoking create subscription', { customerId });
    const createResult = await this.create(body);

    // 5. Post-creation ledger & billing updates for prepaid payments
    if (paymentType === 'prepaid' && createResult?.subscription_id) {
      if (paymentMethod === 'wallet') {
        this.developer.debug('SubscriptionsService.checkout updating wallet reference and adding prepaid bill', {
          subscription_id: createResult.subscription_id,
          customerId,
        });

        // Deduct from wallet atomically
        const updateRes = await this.db.query(
          `UPDATE customers SET wallet_balance = COALESCE(wallet_balance, 0) - $1, updated_at = NOW() WHERE customer_id = $2 RETURNING wallet_balance`,
          [estimatedTotal, customerId],
        );
        const newBalance = Number(updateRes?.[0]?.wallet_balance ?? (walletBalance - estimatedTotal));

        this.developer.debug('SubscriptionsService.checkout deducting wallet balance', {
          customerId,
          walletBalance,
          estimatedTotal,
          newBalance,
        });

        // Record wallet transaction ledger entry
        const ts = Math.floor(Date.now() / 1000).toString(36);
        const rnd = Math.floor(Math.random() * 9000 + 1000);
        const txId = `WT${ts}${rnd}`;

        await this.data.insert(
          'customer_wallet_transactions',
          {
            transaction_id: txId,
            customer_id: customerId,
            transaction_type: 'debit',
            amount: estimatedTotal,
            balance_after: newBalance,
            remarks: 'Subscription prepaid wallet payment',
            reference_type: 'subscription',
            reference_id: createResult.subscription_id,
            created_by: customerId,
            created_at: new Date(),
          },
        );

        const billId = `BILL_${Date.now().toString(36).toUpperCase()}`;
        const startDateStr = body.start_date;
        const endDateStr = body.end_date || calcMonthEndDate(startDateStr);

        await this.data.insert('customer_bills', {
          bill_id: billId,
          customer_id: customerId,
          bill_type: 'subscription',
          reference_id: createResult.subscription_id,
          payment_type: 'prepaid',
          payment_method: paymentMethod,
          billing_from: startDateStr,
          billing_to: endDateStr,
          due_date: startDateStr,
          subtotal: estimatedTotal,
          discount_amount: 0,
          tax_amount: 0,
          total_amount: estimatedTotal,
          paid_amount: estimatedTotal,
          due_amount: 0,
          status: 'paid',
          remarks: 'Prepaid subscription checkout',
          created_at: new Date(),
          updated_at: new Date(),
        });
      } else if (['online', 'upi', 'razorpay'].includes(paymentMethod)) {
        if (consumedOnlineTxn?.transaction_id) {
          await this.customerPaymentService.attachOrderReference(
            consumedOnlineTxn.transaction_id,
            createResult.subscription_id,
          );
        }

        const billId = `BILL_${Date.now().toString(36).toUpperCase()}`;
        const startDateStr = body.start_date;
        const endDateStr = body.end_date || calcMonthEndDate(startDateStr);

        await this.data.insert('customer_bills', {
          bill_id: billId,
          customer_id: customerId,
          bill_type: 'subscription',
          reference_id: createResult.subscription_id,
          payment_type: 'prepaid',
          payment_method: paymentMethod,
          billing_from: startDateStr,
          billing_to: endDateStr,
          due_date: startDateStr,
          subtotal: estimatedTotal,
          discount_amount: 0,
          tax_amount: 0,
          total_amount: estimatedTotal,
          paid_amount: estimatedTotal,
          due_amount: 0,
          status: 'paid',
          remarks: `Prepaid subscription online payment (${body.razorpay_payment_id || body.razorpay_order_id || 'Razorpay'})`,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }

    const response = {
      status: true,
      success: true,
      id: `#${createResult.subscription_id}`,
      subscription_id: createResult.subscription_id,
      subscription_number: createResult.subscription_number,
      message: 'Subscription created successfully',
      items: createResult.items,
    };

    // Send Push, In-App, and Email Notifications
    const subNumber = createResult.subscription_number || createResult.subscription_id;
    const notifTitle = 'Subscription Confirmed! 🎉';
    const notifBody = `Your subscription (#${subNumber}) has been created successfully.`;

    // 1. Push Notification via FCM
    try {
      await this.pushNotificationService.sendNotificationToUsers(
        [customerId],
        {
          title: notifTitle,
          body: notifBody,
        },
      );
    } catch (pushErr) {
      this.developer.error('SubscriptionsService.checkout push notification failed', { customerId, error: pushErr });
    }

    // 2. In-App Notification (Database & WebSocket)
    try {
      await this.notificationService.sendNotification({
        title: notifTitle,
        message: notifBody,
        type: 'success',
        priority: 'high',
        recipientIds: [customerId],
        senderId: customerId,
      });
    } catch (inAppErr) {
      this.developer.error('SubscriptionsService.checkout in-app notification failed', { customerId, error: inAppErr });
    }

    // 3. Email Notification
    const customerEmail = customer?.email || email;
    if (customerEmail) {
      const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') || 'Customer';
      try {
        await this.mailService.sendMail({
          to: customerEmail,
          subject: 'Subscription Confirmed - F2H Fresh 🎉',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
              <h2 style="color: #1b5e20;">Subscription Confirmed! 🎉</h2>
              <p>Hello <strong>${customerName}</strong>,</p>
              <p>Thank you for subscribing with F2H Fresh! Your subscription details are as follows:</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Subscription No:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">#${subNumber}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Schedule Type:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${body.schedule_type || 'weekly'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Payment Type:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${body.payment_type || 'prepaid'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Start Date:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${body.start_date}</td></tr>
              </table>
              <p style="margin-top: 20px;">If you have any questions or need to pause/modify your subscription, open the F2H Fresh app anytime.</p>
              <p style="color: #888; font-size: 12px; margin-top: 30px;">F2H Fresh - Farm 2 Home</p>
            </div>
          `,
        });
      } catch (mailErr) {
        this.developer.error('SubscriptionsService.checkout email notification failed', { email: customerEmail, error: mailErr });
      }
    }

    this.developer.debug('SubscriptionsService.checkout completed successfully', { response });
    return response;
  }

  async create(body: CreateSubscriptionDto) {
    this.developer.debug('SubscriptionsService.create called', { body });

    const itemsList = body.items || [];
    const validItems = itemsList
      .map((item) => ({
        ...item,
        product_variant_id: item.product_variant_id || '',
        schedules: (item.schedules || [])
          .map((schedule, idx) => ({
            day: schedule.day_of_week ?? schedule.day ?? idx,
            m_quantity: Number(schedule.m_quantity ?? schedule.m_qty ?? schedule.morning_qty ?? 0),
            e_quantity: Number(schedule.e_quantity ?? schedule.e_qty ?? schedule.evening_qty ?? 0),
          }))
          .filter((schedule) => schedule.m_quantity > 0 || schedule.e_quantity > 0),
      }))
      .filter((item) => item.schedules.length > 0 && Boolean(item.product_variant_id));

    const customerIdStr = (body.customer_id || '').trim();

    const rawScheduleType = (body.schedule_type || 'weekly').toLowerCase();
    const dbScheduleType = (rawScheduleType === 'custom' || rawScheduleType === 'custom_days' || rawScheduleType === 'custom_dates')
      ? 'custom_dates'
      : 'weekly';

    if (!customerIdStr) {
      throw new BadRequestException('customer_id is required');
    }

    if (!body.start_date) {
      throw new BadRequestException('start_date is required');
    }

    if (dbScheduleType === 'weekly' && validItems.length === 0) {
      throw new BadRequestException('Add at least one quantity');
    }

    if (dbScheduleType === 'custom_dates' && (body.custom_dates || []).length === 0) {
      throw new BadRequestException('Add at least one custom date');
    }

    const branchId = body.branch_id || DEFAULT_BRANCH_ID;

    return this.db.transaction(async (client) => {
      let addressId = body.address_id?.trim();
      if (!addressId || addressId === DEFAULT_ADDRESS_ID) {
        const addrRes = await client.query(
          `SELECT address_id FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, id ASC LIMIT 1`,
          [customerIdStr],
        );
        addressId = addrRes?.rows?.[0]?.address_id || 'ADDR_DEFAULT';
      }

      // 1. Fetch or generate subscription_number from customers table
      const custRes = await client.query(
        `SELECT subscription_number FROM customers WHERE customer_id = $1 LIMIT 1`,
        [customerIdStr],
      );
      let subscriptionNumber = custRes?.rows?.[0]?.subscription_number;

      if (!subscriptionNumber || !subscriptionNumber.trim()) {
        subscriptionNumber = `SUBNO${Date.now()}`;
        await client.query(
          `UPDATE customers SET subscription_number = $1 WHERE customer_id = $2`,
          [subscriptionNumber, customerIdStr],
        );
        this.developer.debug('SubscriptionsService.create generated new subscription_number for customer', {
          customerIdStr,
          subscriptionNumber,
        });
      } else {
        this.developer.debug('SubscriptionsService.create reusing existing subscription_number for customer', {
          customerIdStr,
          subscriptionNumber,
        });
      }

      // Always generate a new subscription_id for each subscription record
      const subscriptionId = this.makeId('SUB');

      this.developer.debug('SubscriptionsService.create initiating DB transaction', {
        subscriptionId,
        subscriptionNumber,
        branchId,
        addressId,
        validItemsCount: validItems.length,
      });

      // 3. Insert new subscription row using varchar subscription_id
      await client.query(
        `
        INSERT INTO subscriptions (
          subscription_id,
          subscription_number,
          customer_id,
          branch_id,
          address_id,
          schedule_type,
          payment_type,
          billing_cycle,
          start_date,
          end_date,
          auto_renew,
          renewal_grace_days,
          status,
          notes,
          metadata,
          monthly_estimate,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', $13, $14, $15, $16, $16)
        `,
        [
          subscriptionId,
          subscriptionNumber,
          customerIdStr,
          branchId,
          addressId,
          dbScheduleType,
          body.payment_type,
          dbScheduleType === 'custom_dates' ? 'custom' : 'monthly',
          body.start_date,
          body.end_date || calcMonthEndDate(body.start_date) || null,
          body.auto_renew,
          body.auto_renew ? 3 : 0,
          body.notes || 'Created from customer subscription form',
          JSON.stringify({
            source: 'customer_app',
            branch_id: branchId,
            custom_dates: body.custom_dates || [],
          }),
          body.monthly_estimate ?? body.estimated_total ?? 0,
          customerIdStr,
        ],
      );

      const insertedItems: { id: string; product_variant_id: string }[] = [];

      for (let index = 0; index < validItems.length; index += 1) {
        const item = validItems[index];

        this.developer.debug('SubscriptionsService.create inserting item', {
          product_variant_id: item.product_variant_id,
          unit_price: item.unit_price,
        });

        const subscriptionItemId = this.makeId('SBI');
        const itemInsertRes = await client.query(
          `
          INSERT INTO subscription_items (
            subscription_item_id,
            subscription_id,
            product_variant_id,
            unit_price,
            discount_id,
            coupon_id,
            discount_amount,
            coupon_amount,
            status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
          RETURNING id, subscription_item_id
          `,
          [
            subscriptionItemId,
            subscriptionId,
            item.product_variant_id,
            item.unit_price || 0,
            item.discount_id || null,
            item.coupon_id || null,
            item.discount_amount || 0,
            item.coupon_amount || 0,
          ],
        );

        const itemId = itemInsertRes.rows?.[0]?.subscription_item_id || subscriptionItemId;

        await this.insertWeeklySchedule(client, itemId, subscriptionId, item, body);

        await client.query(
          `
          INSERT INTO subscription_logs (
            subscription_id,
            subscription_item_id,
            action,
            old_data,
            new_data,
            created_by
          )
          VALUES ($1, $2, 'created', NULL, $3, $4)
          `,
          [
            subscriptionId,
            itemId,
            JSON.stringify({
              product_variant_id: item.product_variant_id,
              schedule_type: body.schedule_type,
              schedules: item.schedules,
              custom_dates: body.custom_dates || [],
            }),
            customerIdStr,
          ],
        );

        insertedItems.push({
          id: itemId,
          product_variant_id: item.product_variant_id,
        });
      }

      this.developer.debug('SubscriptionsService.create transaction successful', {
        subscription_id: subscriptionId,
        subscription_number: subscriptionNumber,
        itemsCount: insertedItems.length,
      });

      return {
        status: true,
        subscription_id: subscriptionId,
        subscription_number: subscriptionNumber,
        items: insertedItems,
      };
    });
  }

  private async insertWeeklySchedule(
    client: PoolClient,
    itemId: string,
    subscriptionId: string,
    item: SubscriptionItemDto,
    body: CreateSubscriptionDto,
  ) {
    const schedules = item.schedules || [];
    this.developer.debug('SubscriptionsService.insertWeeklySchedule called', {
      itemId,
      subscriptionId,
      schedulesCount: schedules.length,
    });

    for (const schedule of schedules) {
      const day = schedule.day_of_week ?? schedule.day ?? 0;
      const mQty = Number(schedule.m_quantity ?? schedule.m_qty ?? schedule.morning_qty ?? 0);
      const eQty = Number(schedule.e_quantity ?? schedule.e_qty ?? schedule.evening_qty ?? 0);

      await client.query(
        `
        INSERT INTO subscription_weekly_schedule (
          subscription_item_id,
          subscription_id,
          day_of_week,
          m_quantity,
          e_quantity,
          effective_from,
          effective_to
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          itemId,
          subscriptionId,
          day,
          mQty,
          eQty,
          body.start_date,
          body.end_date || null,
        ],
      );
    }
  }

  private makeId(prefix: string) {
    return `${prefix}_${Date.now().toString(36).toUpperCase()}${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`.slice(0, 30);
  }

  async getVariants() {
    this.developer.debug('SubscriptionsService.getVariants called');
  }

  async getSubscriptions(userId: string, email: string) {
    this.developer.debug('SubscriptionsService.getSubscriptions called', { userId, email });

    const custRows = await this.db.query(
      `SELECT c.customer_id
       FROM customers c
       JOIN users u ON u.user_id = c.customer_id
       WHERE c.customer_id = $1 OR (u.email IS NOT NULL AND u.email = $2 AND u.email != '')
       LIMIT 1`,
      [userId, email || userId],
    );
    const customer = custRows?.[0];
    if (!customer) {
      this.developer.debug('SubscriptionsService.getSubscriptions customer not found', { userId, email });
      return { status: true, data: [] };
    }

    await this.autoUnpauseExpiredSubscriptions();

    const subsDetails = await this.db.query(`
      SELECT
        s.subscription_id,
        s.subscription_number,
        s.customer_id,
        s.schedule_type,
        s.branch_id,
        s.address_id,
        s.payment_type,
        s.billing_cycle,
        s.start_date,
        s.end_date,
        s.auto_renew,
        s.status,
        s.pause_from_date,
        s.pause_to_date,
        s.monthly_estimate,
        s.created_at,
        s.updated_at,
        COALESCE(si.subscription_item_id, si.id::text) AS subscription_item_id,
        si.product_variant_id,
        si.unit_price,
        si.discount_id,
        si.coupon_id,
        si.discount_amount,
        si.coupon_amount,
        si.final_price,
        si.is_free,
        si.status AS item_status,
        pv.product_id,
        pv.name,
        pv.sku,
        pv.price,
        pv.subscription_price,
        pv.original_price,
        pv.discount,
        pv.unit_value,
        pv.unit_type,
        pv.fulfillment_mode,
        pv.manageable_qty,
        pv.sort_order,
        pv.variant_id,
        pi.storage_key
      FROM subscriptions s
      LEFT JOIN subscription_items si ON si.subscription_id = s.subscription_id
      LEFT JOIN product_variants pv ON pv.variant_id = si.product_variant_id
      LEFT JOIN LATERAL (
        SELECT storage_key FROM product_images pi2
        WHERE pi2.variant_id = pv.variant_id
          AND pi2.storage_key IS NOT NULL AND pi2.storage_key <> ''
          AND (pi2.is_primary = true OR pi2.sort_order = 0)
          AND pi2.deleted_at IS NULL
        ORDER BY pi2.is_primary DESC NULLS LAST, pi2.sort_order ASC NULLS LAST
        LIMIT 1
      ) pi ON true
      WHERE s.customer_id = $1
      ORDER BY s.created_at DESC
    `, [customer.customer_id]);

    const items = subsDetails || [];

    if (items.length === 0) {
      this.developer.debug('SubscriptionsService.getSubscriptions no subscriptions found for customer', { customer_id: customer.customer_id });
      return { status: true, data: [] };
    }

    const subscriptionIds = Array.from(new Set(items.map(item => item.subscription_id).filter(Boolean)));
    let weeklySchedules: any[] = [];
    let pauses: any[] = [];
    let customDates: any[] = [];
    if (subscriptionIds.length > 0) {
      const scheduleRes = await this.data.query('subscription_weekly_schedule', {
        where: [{ column: 'subscription_id', operator: 'IN', value: subscriptionIds }],
      }, true);
      weeklySchedules = scheduleRes.data || [];

      const pauseRes = await this.data.query('subscription_pauses', {
        where: [{ column: 'subscription_id', operator: 'IN', value: subscriptionIds }],
      }, true);
      pauses = pauseRes.data || [];

      const customDateRes = await this.data.query('subscription_custom_schedule', {
        where: [{ column: 'subscription_id', operator: 'IN', value: subscriptionIds }],
      }, true);
      customDates = customDateRes.data || [];
    }


    const baseUrl = process.env.MOBILE_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:5001';
    const mapImagePath = (imagePath: string | null) => {
      if (!imagePath) return null;
      if (imagePath.startsWith('http')) return imagePath;
      let cleanedPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
      if (cleanedPath.startsWith('uploads/')) return `${baseUrl}/${cleanedPath}`;
      return `${baseUrl}/uploads/${cleanedPath}`;
    };

    for (const item of items) {
      item.url = mapImagePath(item.storage_key);
      const subId = item.subscription_id;
      const itemId = item.subscription_item_id || item.id;
      item.weekly_schedules = weeklySchedules.filter(s => s.subscription_id === subId || s.subscription_item_id === itemId);
      item.pauses = pauses.filter(p => p.subscription_id === subId || p.subscription_item_id === itemId);
      item.custom_dates = customDates.filter(
        cd => cd.subscription_id === subId || cd.subscription_item_id === itemId,
      );
    }

    this.developer.debug('SubscriptionsService.getSubscriptions completed', {
      customer_id: customer.customer_id,
      subscriptionsCount: subscriptionIds.length,
      itemsCount: items.length,
    });

    return {
      status: true,
      data: items,
    };
  }

  async makeSubscriptionCalender(subscriptionId: string) {
    this.developer.debug('SubscriptionsService.makeSubscriptionCalender called', { subscriptionId });
    const isItemId = subscriptionId.startsWith('SBI');
    const result = await this.data.query('subscriptions', {
      select: [
        'subscriptions.subscription_id',
        'subscriptions.start_date',
        'subscriptions.end_date',
        'subscriptions.created_at',
        'subscription_items.id AS subscription_item_id'
      ],
      joins: [
        {
          type: 'left',
          table: 'subscription_items',
          on: [
            ['subscriptions.subscription_id', 'subscription_items.subscription_id']
          ]
        }
      ],
      where: [
        isItemId
          ? { column: 'subscription_items.id', operator: '=', value: subscriptionId }
          : { column: 'subscriptions.subscription_id', operator: '=', value: subscriptionId }
      ],
    });

    const items = result.data || [];

    // Extract subscriptionId if isItemId was passed
    const resolvedSubId = items[0]?.subscription_id || subscriptionId;

    // Determine start & end date
    const rawStart = items[0]?.start_date || items[0]?.created_at;
    let start = rawStart ? new Date(rawStart) : new Date();
    if (isNaN(start.getTime())) start = new Date();

    const rawEnd = items[0]?.end_date;
    let end = rawEnd ? new Date(rawEnd) : null;
    if (!end || isNaN(end.getTime())) {
      // Default to 180 days out from start
      end = new Date(start.getTime() + 180 * 24 * 60 * 60 * 1000);
    }

    const itemIds = items.map(item => item.subscription_item_id).filter(Boolean);
    let schedules: any[] = [];

    try {
      const scheduleResult = await this.db.query(
        `SELECT * FROM subscription_weekly_schedule WHERE subscription_id = $1 OR subscription_item_id = ANY($2::text[])`,
        [resolvedSubId, itemIds.length ? itemIds : ['NONE']],
      );
      schedules = Array.isArray(scheduleResult) ? scheduleResult : (scheduleResult as any)?.rows || [];
    } catch (e) {
      this.developer.warn('makeSubscriptionCalender schedule query failed', { error: e });
    }

    const today = new Date();
    const todayStr = new Date(today.getTime() - today.getTimezoneOffset() * 60 * 1000).toISOString().split('T')[0];

    const calendar: any[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const schedule = schedules.find(s => Number(s.day_of_week) === dayOfWeek);

      const offset = d.getTimezoneOffset() * 60 * 1000;
      const localDateStr = new Date(d.getTime() - offset).toISOString().split('T')[0];

      // If no explicit schedule row exists, check if weekly schedule has any entries;
      // if schedules table is empty for this sub, default m_quantity to 1.00 for all days
      let mQty = '0.00';
      let eQty = '0.00';

      if (schedule) {
        mQty = schedule.m_quantity?.toString() ?? '0.00';
        eQty = schedule.e_quantity?.toString() ?? '0.00';
      } else if (schedules.length === 0) {
        mQty = '1.00';
      }

      const hasDelivery = Number(mQty) > 0 || Number(eQty) > 0;

      let status = 'no_delivery';
      if (hasDelivery) {
        if (localDateStr < todayStr) status = 'completed';
        else if (localDateStr === todayStr) status = 'today';
        else status = 'upcoming';
      }

      calendar.push({
        date: localDateStr,
        day_of_week: dayOfWeek,
        m_quantity: mQty,
        e_quantity: eQty,
        status,
      });
    }

    this.developer.debug('SubscriptionsService.makeSubscriptionCalender generated calendar', {
      subscriptionId,
      daysCount: calendar.length,
    });

    return calendar;
  }
  // Subscription Pause with validation and transaction
  async pauseSubscription(subscriptionId: string, startDate?: string, endDate?: string, reason?: string) {
    this.developer.debug('SubscriptionsService.pauseSubscription called', { subscriptionId, startDate, endDate });
    try {
      return await this.db.transaction(async (client) => {
        const subRes = await client.query<any>(
          `SELECT subscription_id, status, pause_from_date, pause_to_date FROM subscriptions WHERE subscription_id = $1 LIMIT 1`,
          [subscriptionId],
        );
        const sub = subRes.rows[0];
        if (!sub) throw new BadRequestException('Subscription not found');
        if (sub.status !== 'active') throw new BadRequestException('Only active subscriptions can be paused');

        const now = new Date();
        const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        const tomorrowObj = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
        tomorrowObj.setDate(tomorrowObj.getDate() + 1);
        const tomorrowStr = tomorrowObj.toISOString().slice(0, 10);

        // Rule: Customer can create a new pause only when pause_to_date IS NULL OR pause_to_date < today
        if (sub.pause_to_date && String(sub.pause_to_date).slice(0, 10) >= todayStr) {
          throw new BadRequestException(
            `Subscription is already paused until ${String(sub.pause_to_date).slice(0, 10)}. Please resume before creating a new pause.`
          );
        }

        const startStr = startDate ? startDate.trim() : tomorrowStr;
        const endStr = endDate ? endDate.trim() : '2099-12-31';

        if (startStr < tomorrowStr) {
          throw new BadRequestException(`Pause start date must be tomorrow (${tomorrowStr}) or later`);
        }
        if (endStr < startStr) {
          throw new BadRequestException('Pause end date cannot be before pause start date');
        }

        // Update subscription status: set 'paused' if pause applies today, or auto-resume if past
        await client.query(
          `UPDATE subscriptions
           SET pause_from_date = $1,
               pause_to_date = $2,
               pause_reason = $3,
               status = CASE 
                 WHEN $1::date <= CURRENT_DATE AND $2::date >= CURRENT_DATE THEN 'paused'
                 WHEN $2::date < CURRENT_DATE THEN 'active'
                 ELSE status 
               END,
               updated_at = now()
           WHERE subscription_id = $4`,
          [startStr, endStr, reason || 'Customer vacation pause', subscriptionId],
        );

        // Insert into subscription_pauses
        await client.query(
          `INSERT INTO subscription_pauses (subscription_id, start_date, end_date, status, reason, created_at, updated_at)
           VALUES ($1, $2, $3, 'paused', $4, now(), now())`,
          [subscriptionId, startStr, endStr, reason || 'Customer vacation pause'],
        );

        // Audit log
        await client.query(
          `INSERT INTO subscription_logs (subscription_id, action, new_data, created_by, created_at)
           VALUES ($1, 'pause', $2, 'customer', now())`,
          [subscriptionId, JSON.stringify({ paused_from: startStr, paused_to: endStr, reason })],
        );

        return {
          status: true,
          message: 'Subscription paused successfully',
        };
      });
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('pauseSubscription error', { error, subscriptionId });
      throw new BadRequestException(error?.message || 'Failed to pause subscription');
    }
  }

  // Subscription Resume — 3-Scenario Logic with Transaction Safety
  async resumeSubscription(subscriptionId: string, requestedResumeDate?: string) {
    this.developer.debug('SubscriptionsService.resumeSubscription called', { subscriptionId, requestedResumeDate });
    try {
      return await this.db.transaction(async (client) => {
        // 1. Fetch subscription
        const subRes = await client.query<any>(
          `SELECT subscription_id, status, pause_from_date, pause_to_date, auto_renew FROM subscriptions WHERE subscription_id = $1 LIMIT 1`,
          [subscriptionId],
        );
        const sub = subRes.rows[0];
        if (!sub) throw new BadRequestException('Subscription not found');
        if (sub.status !== 'active') throw new BadRequestException('Only active subscriptions can be resumed');

        const pFrom = sub.pause_from_date ? String(sub.pause_from_date).slice(0, 10) : null;
        const pTo = sub.pause_to_date ? String(sub.pause_to_date).slice(0, 10) : null;

        const now = new Date();
        const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        const tomorrowObj = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
        tomorrowObj.setDate(tomorrowObj.getDate() + 1);
        const tomorrowStr = tomorrowObj.toISOString().slice(0, 10);

        // Validation: Subscription currently paused
        if (!pFrom || !pTo || pTo < todayStr) {
          throw new BadRequestException('Subscription is not currently paused');
        }

        // Find the latest active pause record
        const pauseRes = await client.query<any>(
          `SELECT id, start_date, end_date, status, reason
           FROM subscription_pauses
           WHERE subscription_id = $1 AND status = 'paused' AND deleted_at IS NULL
           ORDER BY created_at DESC NULLS LAST, id DESC
           LIMIT 1`,
          [subscriptionId],
        );
        const activePause = pauseRes.rows[0];
        if (!activePause) throw new BadRequestException('No active pause record found to resume');

        const activePauseEnd = String(activePause.end_date).slice(0, 10);

        // ── SCENARIO 1: Resume Before Pause Starts ──
        if (todayStr < pFrom) {
          // Pause hasn't started yet. Customer cancels the scheduled pause.
          await client.query(
            `UPDATE subscriptions 
             SET pause_from_date = NULL, 
                 pause_to_date = NULL, 
                 pause_reason = NULL,
                 updated_at = now() 
             WHERE subscription_id = $1`,
            [subscriptionId],
          );

          await client.query(
            `UPDATE subscription_pauses 
             SET status = 'resumed', 
                 updated_at = now() 
             WHERE id = $1`,
            [activePause.id],
          );

          await client.query(
            `UPDATE subscription_items SET status = 'active', updated_at = now() WHERE subscription_id = $1 AND status = 'paused'`,
            [subscriptionId],
          );

          await client.query(
            `INSERT INTO subscription_logs (subscription_id, action, new_data, created_by, created_at)
             VALUES ($1, 'resume_before_start', $2, 'customer', now())`,
            [subscriptionId, JSON.stringify({ resumed_at: todayStr, scenario: 1 })],
          );

          return {
            status: true,
            message: 'Upcoming pause cancelled. Regular deliveries will continue without interruption.',
            scenario: 1,
          };
        }

        // ── SCENARIO 2 & 3: Resume During Ongoing Pause ──
        const resumeDate = (requestedResumeDate || '').trim();
        if (!resumeDate) {
          throw new BadRequestException('Please provide a resume_date (tomorrow or later)');
        }

        if (resumeDate < tomorrowStr) {
          throw new BadRequestException(`Resume date must be tomorrow (${tomorrowStr}) or later`);
        }
        if (resumeDate > pTo) {
          throw new BadRequestException(`Resume date cannot be after current pause end date (${pTo})`);
        }

        // Calculate the day before resumeDate
        const rObj = new Date(resumeDate + 'T00:00:00Z');
        rObj.setUTCDate(rObj.getUTCDate() - 1);
        const dayBeforeResumeStr = rObj.toISOString().slice(0, 10);

        if (dayBeforeResumeStr < pFrom) {
          // Resumed on the very first day
          await client.query(
            `UPDATE subscriptions 
             SET pause_from_date = NULL, 
                 pause_to_date = NULL, 
                 pause_reason = NULL,
                 updated_at = now() 
             WHERE subscription_id = $1`,
            [subscriptionId],
          );
          await client.query(
            `UPDATE subscription_pauses 
             SET status = 'resumed', 
                 updated_at = now() 
             WHERE id = $1`,
            [activePause.id],
          );
        } else {
          // Truncate current pause to end on dayBeforeResumeStr
          await client.query(
            `UPDATE subscriptions 
             SET pause_to_date = $1, 
                 updated_at = now() 
             WHERE subscription_id = $2`,
            [dayBeforeResumeStr, subscriptionId],
          );

          await client.query(
            `UPDATE subscription_pauses 
             SET end_date = $1, 
                 updated_at = now() 
             WHERE id = $2`,
            [dayBeforeResumeStr, activePause.id],
          );

          // Insert new record into subscription_pauses preserving full immutable pause history
          await client.query(
            `INSERT INTO subscription_pauses (subscription_id, start_date, end_date, status, reason, created_at, updated_at)
             VALUES ($1, $2, $3, 'resumed', $4, now(), now())`,
            [
              subscriptionId,
              resumeDate,
              activePauseEnd,
              `Resumed by customer starting ${resumeDate}`,
            ],
          );
        }

        // Reactivate subscription items
        await client.query(
          `UPDATE subscription_items SET status = 'active', updated_at = now() WHERE subscription_id = $1 AND status = 'paused'`,
          [subscriptionId],
        );

        // Audit log
        await client.query(
          `INSERT INTO subscription_logs (subscription_id, action, new_data, created_by, created_at)
           VALUES ($1, 'resume', $2, 'customer', now())`,
          [subscriptionId, JSON.stringify({ resumed_at: todayStr, resume_date: resumeDate })],
        );

        this.developer.debug('SubscriptionsService.resumeSubscription success', { subscriptionId, resumeDate });
        return {
          status: true,
          message: `Subscription resumed successfully! Deliveries will restart on ${resumeDate}.`,
          scenario: resumeDate === pTo ? 3 : 2,
        };
      });
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('resumeSubscription error', { error, subscriptionId });
      throw new BadRequestException(error?.message || 'Failed to resume subscription');
    }
  }

  // Pause History (Immutable audit trail)
  async getPauseHistory(subscriptionId: string) {
    this.developer.debug('SubscriptionsService.getPauseHistory called', { subscriptionId });
    try {
      const rows = await this.db.query(
        `SELECT id, subscription_id, start_date, end_date, status, reason, created_at, updated_at
         FROM subscription_pauses
         WHERE subscription_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC NULLS LAST, id DESC`,
        [subscriptionId],
      );
      return {
        status: true,
        data: Array.isArray(rows) ? rows : [],
      };
    } catch (error: any) {
      this.developer.error('getPauseHistory error', { error, subscriptionId });
      return { status: false, data: [] };
    }
  }

  // Auto Renew Toggle
  async updateAutoRenew(subscriptionId: string, autoRenew: boolean) {
    this.developer.debug('SubscriptionsService.updateAutoRenew called', { subscriptionId, autoRenew });
    try {
      const rows = await this.db.query(
        `UPDATE subscriptions
         SET auto_renew = $1, updated_at = now()
         WHERE subscription_id = $2
         RETURNING subscription_id, auto_renew, updated_at`,
        [Boolean(autoRenew), subscriptionId],
      );
      const updated = Array.isArray(rows) ? rows[0] : null;
      if (!updated) throw new BadRequestException('Subscription not found');

      await this.data.insert('subscription_logs', {
        subscription_id: subscriptionId,
        action: 'update_auto_renew',
        new_data: JSON.stringify({ auto_renew: Boolean(autoRenew) }),
        created_by: 'customer',
      }, { includeDeleted: true });

      return {
        status: true,
        data: updated,
        message: `Auto renew ${autoRenew ? 'enabled' : 'disabled'} successfully`,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('updateAutoRenew error', { error, subscriptionId });
      throw new BadRequestException('Failed to update auto renew setting');
    }
  }

  async cancelSubscription(subscriptionId: string, cancelReason?: string, endDate?: string) {
    this.developer.debug('SubscriptionsService.cancelSubscription called', { subscriptionId, cancelReason, endDate });
    try {
      const subResult = await this.data.query('subscriptions', {
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
        limit: 1,
      }, true);
      if (!subResult?.data?.length) {
        this.developer.error('SubscriptionsService.cancelSubscription subscription not found', { subscriptionId });
        throw new BadRequestException('Subscription not found');
      }

      const cancelledAt = new Date().toISOString();
      const resolvedEndDate = endDate || cancelledAt.slice(0, 10);
      const resolvedReason = cancelReason || 'Cancelled by customer';

      await this.data.query('subscriptions', {
        update: {
          status: 'cancelled',
          end_date: resolvedEndDate,
          cancelled_at: cancelledAt,
          cancel_reason: resolvedReason,
          updated_at: cancelledAt,
        },
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
      }, true);

      await this.data.query('subscription_items', {
        update: { status: 'cancelled', updated_at: cancelledAt },
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
      }, true);

      await this.data.insert('subscription_logs', {
        subscription_id: subscriptionId,
        action: 'cancel',
        new_data: JSON.stringify({ cancelled_at: cancelledAt, cancel_reason: resolvedReason }),
        created_by: 'customer',
      }, { includeDeleted: true });

      this.developer.debug('SubscriptionsService.cancelSubscription success', { subscriptionId });
      return {
        status: true,
        message: 'Subscription cancelled successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('cancelSubscription error', { error, subscriptionId });
      throw new BadRequestException('Failed to cancel subscription');
    }
  }

  // async getPauseHistory(subscriptionId: string) {
  //   this.developer.debug('SubscriptionsService.getPauseHistory called', { subscriptionId });
  //   try {
  //     const pauseRes = await this.data.query('subscription_pauses', {
  //       where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
  //       orderBy: [{ column: 'start_date', direction: 'DESC' }],
  //     }, true);
  //     return {
  //       status: true,
  //       data: pauseRes.data || [],
  //     };
  //   } catch (error) {
  //     this.developer.error('getPauseHistory error', { error, subscriptionId });
  //     throw new BadRequestException('Failed to get pause history');
  //   }
  // }

  async cancelSubscriptionItem(subscriptionItemId: string) {
    this.developer.debug('SubscriptionsService.cancelSubscriptionItem called', { subscriptionItemId });
    try {
      const itemResult = await this.data.query('subscription_items', {
        where: [{ column: 'id', operator: '=', value: subscriptionItemId }],
        limit: 1,
      }, true);
      if (!itemResult?.data?.length) {
        this.developer.error('SubscriptionsService.cancelSubscriptionItem item not found', { subscriptionItemId });
        throw new BadRequestException('Subscription item not found');
      }
      const item = itemResult.data[0];
      const subscriptionId = item.subscription_id;

      await this.data.query('subscription_items', {
        update: {
          status: 'cancelled',
          updated_at: new Date().toISOString()
        },
        where: [{ column: 'id', operator: '=', value: subscriptionItemId }],
      }, true);

      await this.data.insert('subscription_logs', {
        subscription_id: subscriptionId,
        action: 'cancel_item',
        new_data: JSON.stringify({ subscription_item_id: subscriptionItemId, cancelled_at: new Date().toISOString() }),
        created_by: 'customer',
      }, { includeDeleted: true });

      const otherItemsResult = await this.data.query('subscription_items', {
        where: [
          { column: 'subscription_id', operator: '=', value: subscriptionId },
          { column: 'status', operator: '!=', value: 'cancelled' }
        ],
      }, true);

      const activeItems = otherItemsResult?.data || [];
      if (activeItems.length === 0) {
        this.developer.debug('SubscriptionsService.cancelSubscriptionItem all items cancelled, cancelling subscription container', { subscriptionId });
        await this.data.query('subscriptions', {
          update: {
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancel_reason: 'All subscription items cancelled by customer',
            updated_at: new Date().toISOString()
          },
          where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
        }, true);
      }

      this.developer.debug('SubscriptionsService.cancelSubscriptionItem success', { subscriptionItemId });
      return {
        status: true,
        message: 'Subscription item cancelled successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('cancelSubscriptionItem error', { error, subscriptionItemId });
      throw new BadRequestException('Failed to cancel subscription item');
    }
  }

  async getSubscriptionDetail(subscriptionId: string) {
    this.developer.debug('SubscriptionsService.getSubscriptionDetail called', { subscriptionId });
    try {
      // 1. Fetch subscription basic info
      const subRes = await this.data.query('subscriptions', {
        select: ['subscriptions.*'],
        where: [{ column: 'subscriptions.subscription_id', operator: '=', value: subscriptionId }],
        limit: 1,
      }, true);
      const sub = subRes?.data?.[0];
      if (!sub) throw new Error('Subscription not found');

      const customerId = sub.customer_id;

      // 2. Fetch customer wallet balance
      const custRes = await this.data.query('customers', {
        select: ['wallet_balance'],
        where: [{ column: 'customer_id', operator: '=', value: customerId }],
        limit: 1,
      });
      const walletBalance = Number(custRes?.data?.[0]?.wallet_balance || 0);

      // 3. Fetch outstanding bills (by subscription reference or customer_id)
      const billsRes = await this.db.query(
        `SELECT
           bill_id, status, total_amount, paid_amount, due_amount, due_date,
           billing_from, billing_to, payment_type, payment_method, created_at
         FROM customer_bills
         WHERE (reference_id = $1 OR customer_id = $2)
         ORDER BY created_at DESC
         LIMIT 5`,
        [subscriptionId, customerId],
      );
      const latestBills = Array.isArray(billsRes) ? billsRes : [];

      // 4. Outstanding count & amount from customer_bills
      const outstandingRes = await this.db.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(due_amount), 0) as total_due
         FROM customer_bills
         WHERE (reference_id = $1 OR customer_id = $2)
           AND status NOT IN ('paid', 'cancelled')
           AND due_amount > 0`,
        [subscriptionId, customerId],
      );
      const outstandingRow = Array.isArray(outstandingRes) ? outstandingRes[0] : {};
      let outstandingBillCount = Number(outstandingRow?.count || 0);
      let outstandingAmount = Number(outstandingRow?.total_due || 0);

      // 4b. Add unbilled delivered/active postpaid orders for this customer
      const isPostpaidSub = sub.payment_type === 'postpaid';
      const unbilledRes = await this.db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as unbilled_due, COUNT(*) as unbilled_count
         FROM public.orders
         WHERE customer_id = $1
           AND (payment_type = 'postpaid' OR payment_method = 'postpaid' OR $2 = true)
           AND payment_status NOT IN ('paid', 'refunded')
           AND status NOT IN ('cancelled', 'returned')
           AND NOT EXISTS (
             SELECT 1 FROM public.customer_bill_items cbi
             WHERE cbi.reference_id = orders.order_id
           )`,
        [customerId, isPostpaidSub],
      );
      const unbilledRow = Array.isArray(unbilledRes) ? unbilledRes[0] : {};
      const unbilledDue = Number(unbilledRow?.unbilled_due || 0);
      const unbilledCount = Number(unbilledRow?.unbilled_count || 0);

      outstandingAmount += unbilledDue;
      if (outstandingBillCount === 0 && unbilledCount > 0) {
        outstandingBillCount = unbilledCount;
      }

      // 5. Alert flags
      const isAutoRenew = Boolean(sub.auto_renew === true || sub.auto_renew === 't' || sub.auto_renew === 'true');
      const isPostpaid = sub.payment_type === 'postpaid';

      // For auto_renew prepaid: estimate next renewal cost from weekly schedule
      let nextRenewalEstimate = 0;
      if (isAutoRenew && !isPostpaid) {
        const schedRes = await this.db.query(
          `SELECT sws.m_quantity, sws.e_quantity, si.unit_price
           FROM subscription_weekly_schedule sws
           JOIN subscription_items si ON si.subscription_item_id = sws.subscription_item_id
           WHERE sws.subscription_id = $1`,
          [subscriptionId],
        );
        const schedRows = Array.isArray(schedRes) ? schedRes : [];
        for (const row of schedRows) {
          nextRenewalEstimate += (Number(row.m_quantity) + Number(row.e_quantity)) * Number(row.unit_price);
        }
        // Multiply by average days in month (30) / 7 days
        nextRenewalEstimate = Math.round((nextRenewalEstimate / 7) * 30);
      }

      const alertLowBalance = isAutoRenew && !isPostpaid && nextRenewalEstimate > 0 && walletBalance < nextRenewalEstimate;
      const alertOutstandingBills = outstandingBillCount > 0;

      return {
        status: true,
        wallet_balance: walletBalance,
        next_renewal_estimate: nextRenewalEstimate,
        outstanding_bill_count: outstandingBillCount,
        outstanding_amount: outstandingAmount,
        alert_low_balance: alertLowBalance,
        alert_outstanding_bills: alertOutstandingBills,
        latest_bills: latestBills,
      };
    } catch (error) {
      this.developer.error('getSubscriptionDetail error', { error, subscriptionId });
      return {
        status: false,
        wallet_balance: 0,
        next_renewal_estimate: 0,
        outstanding_bill_count: 0,
        outstanding_amount: 0,
        alert_low_balance: false,
        alert_outstanding_bills: false,
        latest_bills: [],
      };
    }
  }

  async getSubscriptionBills(subscriptionId: string) {
    this.developer.debug('SubscriptionsService.getSubscriptionBills called', { subscriptionId });
    try {
      const billsRes = await this.db.query(
        `SELECT
           bill_id, customer_id, bill_type, reference_id, payment_type, payment_method,
           billing_from, billing_to, due_date, subtotal, discount_amount, tax_amount,
           total_amount, paid_amount, due_amount, status, remarks, created_at, updated_at
         FROM customer_bills
         WHERE reference_id = $1
         ORDER BY created_at DESC`,
        [subscriptionId],
      );
      return {
        status: true,
        data: Array.isArray(billsRes) ? billsRes : [],
      };
    } catch (error) {
      this.developer.error('getSubscriptionBills error', { error, subscriptionId });
      return { status: false, data: [] };
    }
  }

  /**
   * Automatically resumes subscriptions whose pause end date has expired (pause_to_date < CURRENT_DATE).
   */
  async autoUnpauseExpiredSubscriptions(): Promise<void> {
    try {
      await this.db.query(`
        UPDATE subscriptions
        SET status = 'active',
            pause_from_date = NULL,
            pause_to_date = NULL,
            pause_reason = NULL,
            updated_at = NOW(),
            updated_by = 'system_auto_resume'
        WHERE (status = 'paused' OR pause_to_date IS NOT NULL)
          AND pause_to_date IS NOT NULL
          AND pause_to_date < CURRENT_DATE;
      `);

      await this.db.query(`
        UPDATE subscription_pauses
        SET status = 'completed',
            updated_at = NOW()
        WHERE status = 'paused'
          AND end_date IS NOT NULL
          AND end_date < CURRENT_DATE;
      `);
    } catch (error) {
      this.developer.error('Error auto-unpausing expired subscriptions', { error });
    }
  }
}
