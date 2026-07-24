import { BadRequestException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import {
  CreateSubscriptionDto,
  SubscriptionItemDto,
} from '../dto/subscription.dto';

const DEFAULT_BRANCH_ID = 'ALL';
const DEFAULT_ADDRESS_ID = 'ADDR_DEFAULT';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly data: DataService,
    private readonly developer: DeveloperService,
  ) { }

  async checkout(body: CreateSubscriptionDto, req?: any) {
    this.developer.debug('SubscriptionsService.checkout called', { body });

    const customerId = body.customer_id?.trim();
    const estimatedTotal = Number(body.estimated_total || 0);

    if (!customerId) {
      this.developer.error('SubscriptionsService.checkout missing customer_id', { body });
      throw new BadRequestException('customer_id is required');
    }

    

    const email = (req as any)?.user?.email;
    let customerResult = await this.data.query('customers', {
      select: ['customer_id', 'wallet_balance', 'is_postpaid_enabled', 'postpaid_credit_limit', 'email', 'branch_id'],
      where: [{ column: 'customer_id', operator: '=', value: customerId }],
      limit: 1,
    });
    let customer = customerResult?.data?.[0];
    if (!customer && email) {
      customerResult = await this.data.query('customers', {
        where: [{ column: 'email', operator: '=', value: email }],
        limit: 1,
      });
      customer = customerResult?.data?.[0];
    }
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
          customer = {
            customer_id: customerId,
            first_name: userObj.first_name || userObj.user_name || 'Customer',
            last_name: userObj.last_name || '',
            mobile: userObj.phone || ('NO_PHONE_' + customerId),
            phone: userObj.phone || ('NO_PHONE_' + customerId),
            email: userObj.email || email || null,
            branch_id: activeBranchId,
            wallet_balance: 0,
            is_postpaid_enabled: false,
            postpaid_credit_limit: 0,
            created_at: now,
            updated_at: now,
          };
          await this.data.insert('customers', customer);
        }
      } catch (_) {}
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

    // 2. PREPAID validation & wallet deduction
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
            error_code: 'insufficient wallet',
            message: 'Insufficient wallet balance',
            wallet_balance: walletBalance,
            required: estimatedTotal,
          };
        }

      }else{
        // TODO: Implement other payment methods
      }
    }

    // 3. POSTPAID validation
    if (paymentType === 'postpaid') {
      const isPostpaidEnabled = Boolean(customer.is_postpaid_enabled === 't' ||customer.is_postpaid_enabled === true || customer.is_postpaid_enabled === 'true');
      const creditLimit = Number(customer.postpaid_credit_limit || 0);

      if (!isPostpaidEnabled) {
        return {
          status: false,
          error_code: 'postpaid not enabled',
          message: 'Postpaid facility is not enabled on your account. Please select Prepaid option.',
        };
      }

      // Calculate monthly estimations of existing active/paused postpaid subscriptions
      const existingSubsRes = await this.db.query(
        `SELECT
          si.unit_price,
          COALESCE(SUM(sws.m_quantity + sws.e_quantity), 0) AS weekly_qty
        FROM subscriptions s
        JOIN subscription_items si
            ON si.subscription_id = s.subscription_id
        LEFT JOIN subscription_weekly_schedule sws
            ON sws.subscription_item_id = si.subscription_item_id
        WHERE s.customer_id = $1
          AND s.payment_type = 'postpaid'
          AND LOWER(s.status) IN ('active', 'paused')
        GROUP BY si.subscription_item_id, si.unit_price;`,
        [customerId],
      );

      let existingCommitted = 0;
      if (Array.isArray(existingSubsRes)) {
        for (const row of existingSubsRes) {
          const unitPrice = Number(row.unit_price || 0);
          const weeklyQty = Number(row.weekly_qty || 0);
          existingCommitted += (unitPrice * (weeklyQty / 7)) * 30; // Monthly estimation
        }
      }

      const combinedTotal = existingCommitted + estimatedTotal;
      if (creditLimit > 0 && combinedTotal > creditLimit) {
        return {
          status: false,
          error_code: 'credit limit exceeded',
          message: 'Postpaid credit limit exceeded. Please re-select Prepaid option.',
          credit_limit: creditLimit,
          existing_committed: existingCommitted,
          requested: estimatedTotal,
        };
      }
    }

    // 4. Create subscription
    this.developer.debug('SubscriptionsService.checkout invoking create subscription', { customerId });
    const createResult = await this.create(body);

    // 5. Post-creation ledger & billing updates for prepaid payments
    if (paymentType === 'prepaid' && paymentMethod === 'wallet' && createResult?.subscription_id) {
      this.developer.debug('SubscriptionsService.checkout updating wallet reference and adding prepaid bill', {
        subscription_id: createResult.subscription_id,
        customerId,
      });

      
        // Deduct from wallet
        const newBalance = walletBalance - estimatedTotal;
        this.developer.debug('SubscriptionsService.checkout deducting wallet balance', {
          customerId,
          walletBalance,
          estimatedTotal,
          newBalance,
        });

        await this.db.query(
          `UPDATE customers SET wallet_balance = $1 WHERE customer_id = $2`,
          [newBalance, customerId],
        );

        // Record wallet transaction ledger entry
        await this.data.insert(
          'customer_wallet_transactions',
          {
            customer_id: customerId,
            transaction_type: 'debit',
            amount: estimatedTotal,
            balance_after: newBalance,
            remarks: 'Subscription prepaid wallet payment',
            reference_type: 'subscription',
            reference_id: 'PENDING_SUB',
            created_by: customerId,
            created_at: new Date(),
          },
        );

      const billId = `BILL_${Date.now().toString(36).toUpperCase()}`;
      const startDateStr = body.start_date;
      const endDateStr = body.end_date || startDateStr;

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
    }

    const response = {
      status: true,
      success: true,
      id: `#SUB-${createResult.subscription_id}`,
      subscription_id: createResult.subscription_id,
      subscription_number: createResult.subscription_number,
      message: 'Subscription created successfully',
      items: createResult.items,
    };

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

    if (!customerIdStr) {
      throw new BadRequestException('customer_id is required');
    }

    if (!body.start_date) {
      throw new BadRequestException('start_date is required');
    }

    if (body.schedule_type === 'weekly' && validItems.length === 0) {

      throw new BadRequestException('Add at least one weekly quantity');
    }

    if (body.schedule_type === 'custom_dates' && (body.custom_dates || []).length === 0) {

      throw new BadRequestException('Add at least one custom date');
    }

    const branchId = body.branch_id || DEFAULT_BRANCH_ID;
    const addressId = body.address_id || DEFAULT_ADDRESS_ID;

    return this.db.transaction(async (client) => {
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

      // 2. Remove existing subscription records for this customer (customer_id is UNIQUE in subscriptions table)
      // const existingSub = await client.query(
      //   `SELECT subscription_id FROM subscriptions WHERE customer_id = $1 LIMIT 1`,
      //   [customerIdStr],
      // );
      // if (existingSub?.rows?.length > 0) {
      //   const oldSubId = existingSub.rows[0].subscription_id;
      //   this.developer.debug('SubscriptionsService.create replacing existing subscription', { oldSubId, customerIdStr });
      //   await client.query(`DELETE FROM subscription_weekly_schedule WHERE subscription_id = $1`, [oldSubId]);
      //   await client.query(`DELETE FROM subscription_items WHERE subscription_id = $1`, [oldSubId]);
      //   await client.query(`DELETE FROM subscriptions WHERE customer_id = $1`, [customerIdStr]);
      // }

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
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', $13, $14, $15, $15)
        `,
        [
          subscriptionId,
          subscriptionNumber,
          customerIdStr,
          branchId,
          addressId,
          body.schedule_type,
          body.payment_type,
          body.schedule_type === 'custom_dates' ? 'custom' : 'monthly',
          body.start_date,
          body.end_date || null,
          body.auto_renew,
          body.auto_renew ? 3 : 0,
          body.notes || 'Created from customer subscription form',
          {
            source: 'customer_app',
            branch_id: branchId,
            custom_dates: body.custom_dates || [],
          },
          customerIdStr,
        ],
      );

      const insertedItems: { id: string; product_variant_id: string }[] = [];

      for (let index = 0; index < validItems.length; index += 1) {
        const item = validItems[index];
        const itemId = this.makeId(`SBI${index + 1}`);

        this.developer.debug('SubscriptionsService.create inserting item', {
          itemId,
          product_variant_id: item.product_variant_id,
          unit_price: item.unit_price,
        });

        await client.query(
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
            status,
            start_date,
            end_date
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10)
          `,
          [
            itemId,
            subscriptionId,
            item.product_variant_id,
            item.unit_price || 0,
            item.discount_id || null,
            item.coupon_id || null,
            item.discount_amount || 0,
            item.coupon_amount || 0,
            body.start_date,
            body.end_date || null,
          ],
        );

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
            {
              product_variant_id: item.product_variant_id,
              schedule_type: body.schedule_type,
              schedules: item.schedules,
              custom_dates: body.custom_dates || [],
            },
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

    let customerResult = await this.data.query('customers', {
      where: [{ column: 'email', operator: '=', value: email }],
      limit: 1,
    });
    if (!customerResult?.data?.length) {
      customerResult = await this.data.query('customers', {
        where: [{ column: 'customer_id', operator: '=', value: userId }],
        limit: 1,
      });
    }
    const customer = customerResult?.data?.[0];
    if (!customer) {
      this.developer.debug('SubscriptionsService.getSubscriptions customer not found', { userId, email });
      return { status: true, data: [] };
    }

    const subsDetails = await this.data.query('subscriptions', {
      select: [
        'subscriptions.subscription_id',
        'subscriptions.subscription_number',
        'subscriptions.customer_id',
        'subscriptions.schedule_type',
        'subscriptions.branch_id',
        'subscriptions.address_id',
        'subscriptions.payment_type',
        'subscriptions.billing_cycle',
        'subscriptions.start_date',
        'subscriptions.end_date',
        'subscriptions.auto_renew',
        'subscriptions.status',
        'subscriptions.pause_from_date',
        'subscriptions.pause_to_date',
        'subscriptions.created_at',
        'subscriptions.updated_at',
        'subscription_items.id AS subscription_item_id',
        'subscription_items.product_variant_id',
        'subscription_items.unit_price',
        'subscription_items.discount_id',
        'subscription_items.coupon_id',
        'subscription_items.discount_amount',
        'subscription_items.coupon_amount',
        'subscription_items.final_price',
        'subscription_items.is_free',
        'subscription_items.status AS item_status',
        'subscription_items.start_date AS item_start_date',
        'subscription_items.end_date AS item_end_date',
        'product_variants.product_id',
        'product_variants.name',
        'product_variants.sku',
        'product_variants.price',
        'product_variants.subscription_price',
        'product_variants.unit_value',
        'product_variants.unit_type',
        'product_variants.fulfillment_mode',
        'product_variants.is_out_of_stock',
        'product_variants.manageable_qty',
        'product_variants.sort_order',
        'product_variants.variant_id',
        'product_images.url'
      ],
      joins: [
        {
          type: 'left',
          table: 'subscription_items',
          on: [
            ['subscriptions.subscription_id', 'subscription_items.subscription_id']
          ]
        },
        {
          type: 'left',
          table: 'product_variants',
          on: [
            ['subscription_items.product_variant_id', 'product_variants.variant_id']
          ]
        },
        {
          type: 'left',
          table: 'product_images',
          on: [
            ['product_variants.variant_id', 'product_images.variant_id']
          ]
        }
      ],
      where: [{ column: 'subscriptions.customer_id', operator: '=', value: customer.customer_id }],
      orderBy: [{ column: 'created_at', direction: 'DESC' }],
    });

    const items = subsDetails.data || [];
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:8000';
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

    const mapImagePath = (imagePath: string | null) => {
      if (!imagePath) return null;
      if (imagePath.startsWith('http')) return imagePath;
      let cleanedPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
      if (cleanedPath.startsWith('uploads/')) {
        return `${baseUrl}/${cleanedPath}`;
      }
      return `${baseUrl}/uploads/${cleanedPath}`;
    };

    for (const item of items) {
      item.url = mapImagePath(item.url);
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
        'subscriptions.start_date',
        'subscriptions.end_date',
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
    if (!items.length) {
      this.developer.warn('SubscriptionsService.makeSubscriptionCalender no items found', { subscriptionId });
      return [];
    }

    const startDate = items[0].start_date;
    const endDate = items[0].end_date;
    const itemIds = items.map(item => item.subscription_item_id).filter(Boolean);
    let schedules: any[] = [];
    if (itemIds.length > 0) {
      const scheduleResult = await this.data.query('subscription_weekly_schedule', {
        select: ['subscription_weekly_schedule.*'],
        where: [{ column: 'subscription_item_id', operator: 'IN', value: itemIds }],
      });
      schedules = scheduleResult.data || [];
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const calendar: any[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const schedule = schedules.find(s => Number(s.day_of_week) === dayOfWeek);

      const offset = d.getTimezoneOffset() * 60 * 1000;
      const localDateStr = new Date(d.getTime() - offset).toISOString().split('T')[0];

      calendar.push({
        date: localDateStr,
        day_of_week: dayOfWeek,
        m_quantity: schedule ? schedule.m_quantity : "0.00",
        e_quantity: schedule ? schedule.e_quantity : "0.00",
      });
    }

    this.developer.debug('SubscriptionsService.makeSubscriptionCalender generated calendar', {
      subscriptionId,
      daysCount: calendar.length,
    });

    return calendar;
  }

  async pauseSubscription(subscriptionId: string, startDate?: string, endDate?: string) {
    this.developer.debug('SubscriptionsService.pauseSubscription called', { subscriptionId, startDate, endDate });
    try {
      const subResult = await this.data.query('subscriptions', {
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
        limit: 1,
      }, true);
      if (!subResult?.data?.length) {
        this.developer.error('SubscriptionsService.pauseSubscription subscription not found', { subscriptionId });
        throw new BadRequestException('Subscription not found');
      }

      const updateData: any = { updated_at: new Date().toISOString() };
      if (startDate) updateData.pause_from_date = startDate;
      if (endDate) updateData.pause_to_date = endDate;

      await this.data.query('subscriptions', {
        update: updateData,
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
      }, true);

      const itemsResult = await this.data.query('subscription_items', {
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
      }, true);
      const items = itemsResult.data || [];

      const todayStr = new Date().toISOString().slice(0, 10);
      const startStr = startDate || todayStr;
      const endStr = endDate || '2099-12-31';
      for (const item of items) {
        if (item.status !== 'cancelled' && item.status !== 'expired') {
          const activePauseCheck = await this.data.query('subscription_pauses', {
            where: [
              { column: 'subscription_item_id', operator: '=', value: item.id },
              { column: 'end_date', operator: '=', value: endStr }
            ],
            limit: 1,
          }, true);

          if (!activePauseCheck?.data?.length) {
            await this.data.insert('subscription_pauses', {
              subscription_id: subscriptionId,
              subscription_item_id: item.id,
              start_date: startStr,
              end_date: endStr,
              reason: 'Paused by customer',
            }, { includeDeleted: true });
          }
        }
      }

      await this.data.insert('subscription_logs', {
        subscription_id: subscriptionId,
        action: 'pause',
        new_data: JSON.stringify({ paused_at: startStr, end_at: endStr }),
        created_by: 'customer',
      }, { includeDeleted: true });

      this.developer.debug('SubscriptionsService.pauseSubscription success', { subscriptionId });
      return {
        status: true,
        message: 'Subscription paused successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('pauseSubscription error', { error, subscriptionId });
      throw new BadRequestException('Failed to pause subscription');
    }
  }

  async resumeSubscription(subscriptionId: string) {
    this.developer.debug('SubscriptionsService.resumeSubscription called', { subscriptionId });
    try {
      const subResult = await this.data.query('subscriptions', {
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
        limit: 1,
      }, true);
      if (!subResult?.data?.length) {
        this.developer.error('SubscriptionsService.resumeSubscription subscription not found', { subscriptionId });
        throw new BadRequestException('Subscription not found');
      }

      await this.data.query('subscriptions', {
        update: {
          status: 'active',
          pause_from_date: null,
          pause_to_date: null,
          updated_at: new Date().toISOString()
        },
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
      }, true);

      await this.data.query('subscription_items', {
        update: { status: 'active', updated_at: new Date().toISOString() },
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
      }, true);

      const todayStr = new Date().toISOString().slice(0, 10);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      const activePausesRes = await this.data.query('subscription_pauses', {
        where: [
          { column: 'subscription_id', operator: '=', value: subscriptionId },
          { column: 'end_date', operator: '=', value: '2099-12-31' }
        ]
      }, true);
      const activePauses = activePausesRes.data || [];

      for (const p of activePauses) {
        const pStartDate = p.start_date instanceof Date ? p.start_date.toISOString().slice(0, 10) : String(p.start_date).slice(0, 10);
        if (pStartDate === todayStr) {
          await this.data.query('subscription_pauses', {
            delete: true,
            where: [{ column: 'id', operator: '=', value: p.id }]
          }, true);
        } else {
          await this.data.query('subscription_pauses', {
            update: { end_date: yesterdayStr },
            where: [{ column: 'id', operator: '=', value: p.id }]
          }, true);
        }
      }

      await this.data.insert('subscription_logs', {
        subscription_id: subscriptionId,
        action: 'resume',
        new_data: JSON.stringify({ resumed_at: todayStr }),
        created_by: 'customer',
      }, { includeDeleted: true });

      this.developer.debug('SubscriptionsService.resumeSubscription success', { subscriptionId });
      return {
        status: true,
        message: 'Subscription resumed successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('resumeSubscription error', { error, subscriptionId });
      throw new BadRequestException('Failed to resume subscription');
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

  async getPauseHistory(subscriptionId: string) {
    this.developer.debug('SubscriptionsService.getPauseHistory called', { subscriptionId });
    try {
      const pauseRes = await this.data.query('subscription_pauses', {
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
        orderBy: [{ column: 'start_date', direction: 'DESC' }],
      }, true);
      return {
        status: true,
        data: pauseRes.data || [],
      };
    } catch (error) {
      this.developer.error('getPauseHistory error', { error, subscriptionId });
      throw new BadRequestException('Failed to get pause history');
    }
  }

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
}
