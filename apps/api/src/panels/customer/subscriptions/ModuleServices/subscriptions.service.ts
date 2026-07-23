import { BadRequestException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import {
  CreateDeveloperSubscriptionDto,
  DeveloperSubscriptionItemDto,
} from '../dto/create-developer-subscription.dto';

const ROUTE_CAPACITY = 120;
const DEFAULT_BRANCH_ID = 'ALL';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly data: DataService,
    private readonly developer: DeveloperService,
  ) { }

  async getSubscriptions(userId: string, email: string) {
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
      return { status: true, data: [] };
    }

    const subsDetails = await this.data.query('subscriptions', {
      select: [
        'subscriptions.*',
        'subscription_items.subscription_item_id',
        'subscription_items.product_variant_id',
        'subscription_items.default_m_quantity',
        'subscription_items.default_e_quantity',
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
    if (items.length === 0) return { status: true, data: [] };

    const subscriptionIds = Array.from(new Set(items.map(item => item.subscription_id || item.id).filter(Boolean)));
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
      const subId = item.subscription_id || item.id;
      const itemId = item.subscription_item_id || item.si_id || item.id;
      item.weekly_schedules = weeklySchedules.filter(s => s.subscription_id === subId);
      item.pauses = pauses.filter(p => p.subscription_id === subId);
      item.custom_dates = customDates.filter(
        cd => cd.subscription_id === subId || cd.subscription_item_id === itemId,
      );
    }

    return {
      status: true,
      data: items,
    };
  }

  async makeSubscriptionCalender(subscriptionId: string) {
    const isItemId = subscriptionId.startsWith('SUBITEM');
    const result = await this.data.query('subscriptions', {
      select: [
        'subscriptions.start_date',
        'subscriptions.end_date',
        'subscription_items.subscription_item_id'
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
            ? { column: 'subscription_items.subscription_item_id', operator: '=', value: subscriptionId }
            : { column: 'subscriptions.subscription_id', operator: '=', value: subscriptionId }
      ],
    });

    const items = result.data || [];
    if (!items.length) return [];

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
    const scheduleMap = new Map<string, any[]>();
    for (const sched of schedules) {
      if (!scheduleMap.has(sched.subscription_item_id)) {
        scheduleMap.set(sched.subscription_item_id, []);
      }
      scheduleMap.get(sched.subscription_item_id)!.push({
        id: sched.id,
        day_of_week: sched.day_of_week,
        m_quantity: sched.m_quantity,
        e_quantity: sched.e_quantity,
        effective_from: sched.effective_from,
        effective_to: sched.effective_to
      });
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

    return calendar;
  }

  async pauseSubscription(subscriptionId: string, startDate?: string, endDate?: string) {
    console.log(subscriptionId, startDate, endDate);
    try {
      // 1. Check if subscription exists
      const subResult = await this.data.query('subscriptions', {
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
        limit: 1,
      }, true);
      if (!subResult?.data?.length) {
        throw new BadRequestException('Subscription not found');
      }

      // 2. Update subscription pause dates in subscriptions table (status remains active)
      const updateData: any = { updated_at: new Date().toISOString() };
      if (startDate) updateData.pause_from_date = startDate;
      if (endDate) updateData.pause_to_date = endDate;

      await this.data.query('subscriptions', {
        update: updateData,
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
      }, true);

      // 3. Update status of subscription items to paused (Disabled: we keep them active)
      // await this.data.query('subscription_items', {
      //   update: { status: 'paused', updated_at: new Date().toISOString() },
      //   where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
      // }, true);

      // 4. Fetch subscription items to create pauses
      const itemsResult = await this.data.query('subscription_items', {
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
      }, true);
      const items = itemsResult.data || [];

      // 5. Insert pause record for each item
      const todayStr = new Date().toISOString().slice(0, 10);
      const startStr = startDate || todayStr;
      const endStr = endDate || '2099-12-31';
      for (const item of items) {
        // Only pause active/paused items (avoid expired/cancelled)
        if (item.status !== 'cancelled' && item.status !== 'expired') {
          // Check if there is already an active pause for this item to avoid duplicates
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

      // 6. Log the action
      await this.data.insert('subscription_logs', {
        subscription_id: subscriptionId,
        action: 'pause',
        new_data: JSON.stringify({ paused_at: startStr, end_at: endStr }),
        created_by: 'customer',
      }, { includeDeleted: true });

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
    try {
      // 1. Check if subscription exists
      const subResult = await this.data.query('subscriptions', {
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
        limit: 1,
      }, true);
      if (!subResult?.data?.length) {
        throw new BadRequestException('Subscription not found');
      }

      // 2. Update status of subscription to active and clear pause dates
      await this.data.query('subscriptions', {
        update: {
          status: 'active',
          pause_from_date: null,
          pause_to_date: null,
          updated_at: new Date().toISOString()
        },
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
      }, true);

      // 3. Update status of subscription items to active
      await this.data.query('subscription_items', {
        update: { status: 'active', updated_at: new Date().toISOString() },
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
      }, true);

      // 4. Update end_date of active pauses to yesterday (ends vacation)
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
          // If paused today and resumed today, delete pause record to prevent start_date > end_date
          await this.data.query('subscription_pauses', {
            delete: true,
            where: [{ column: 'id', operator: '=', value: p.id }]
          }, true);
        } else {
          // Update end_date to yesterday
          await this.data.query('subscription_pauses', {
            update: { end_date: yesterdayStr },
            where: [{ column: 'id', operator: '=', value: p.id }]
          }, true);
        }
      }

      // 5. Log the action
      await this.data.insert('subscription_logs', {
        subscription_id: subscriptionId,
        action: 'resume',
        new_data: JSON.stringify({ resumed_at: todayStr }),
        created_by: 'customer',
      }, { includeDeleted: true });

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
    try {
      // 1. Check if subscription exists
      const subResult = await this.data.query('subscriptions', {
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
        limit: 1,
      }, true);
      if (!subResult?.data?.length) {
        throw new BadRequestException('Subscription not found');
      }

      const cancelledAt = new Date().toISOString();
      const resolvedEndDate = endDate || cancelledAt.slice(0, 10);
      const resolvedReason = cancelReason || 'Cancelled by customer';

      // 2. Update status of subscription to cancelled with reason and end_date
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

      // 3. Update status of subscription items to cancelled
      await this.data.query('subscription_items', {
        update: { status: 'cancelled', updated_at: cancelledAt },
        where: [{ column: 'subscription_id', operator: '=', value: subscriptionId }],
      }, true);

      // 4. Log the action
      await this.data.insert('subscription_logs', {
        subscription_id: subscriptionId,
        action: 'cancel',
        new_data: JSON.stringify({ cancelled_at: cancelledAt, cancel_reason: resolvedReason }),
        created_by: 'customer',
      }, { includeDeleted: true });

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
    try {
      // 1. Check if subscription item exists
      const itemResult = await this.data.query('subscription_items', {
        where: [{ column: 'subscription_item_id', operator: '=', value: subscriptionItemId }],
        limit: 1,
      }, true);
      if (!itemResult?.data?.length) {
        throw new BadRequestException('Subscription item not found');
      }
      const item = itemResult.data[0];
      const subscriptionId = item.subscription_id;

      // 2. Update status of subscription item to cancelled
      await this.data.query('subscription_items', {
        update: {
          status: 'cancelled',
          updated_at: new Date().toISOString()
        },
        where: [{ column: 'subscription_item_id', operator: '=', value: subscriptionItemId }],
      }, true);

      // 3. Log the action
      await this.data.insert('subscription_logs', {
        subscription_id: subscriptionId,
        action: 'cancel_item',
        new_data: JSON.stringify({ subscription_item_id: subscriptionItemId, cancelled_at: new Date().toISOString() }),
        created_by: 'customer',
      }, { includeDeleted: true });

      // 4. Check if there are any other active items in this subscription
      const otherItemsResult = await this.data.query('subscription_items', {
        where: [
          { column: 'subscription_id', operator: '=', value: subscriptionId },
          { column: 'status', operator: '!=', value: 'cancelled' }
        ],
      }, true);

      const activeItems = otherItemsResult?.data || [];
      if (activeItems.length === 0) {
        // No other active items, so cancel the main subscription as well
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

  // ─────────────────────────────────────────────────────────────────────────
  // SKIP DELIVERY FOR A DATE
  // Customer skips one specific delivery date (before cutoff at 22:00 IST)
  // ─────────────────────────────────────────────────────────────────────────
  async skipDelivery(subscriptionId: string, date: string, userId: string) {
    try {
      if (!date) throw new BadRequestException('date is required');

      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) throw new BadRequestException('Invalid date');

      const today = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const nowIST = new Date(today.getTime() + istOffset);
      const todayIST = nowIST.toISOString().slice(0, 10);

      if (date <= todayIST) throw new BadRequestException('Can only skip future dates');

      // Cutoff: 22:00 IST for tomorrow's delivery
      const tomorrow = new Date(nowIST);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);
      if (date === tomorrowStr) {
        const hourIST = nowIST.getUTCHours();
        if (hourIST >= 22) throw new BadRequestException('Cutoff passed (10 PM IST) — cannot skip tomorrow\'s delivery');
      }

      // Check subscription exists and is active
      const subRes = await this.db.query(
        `SELECT subscription_id, status FROM subscriptions WHERE subscription_id = $1`,
        [subscriptionId],
      );
      if (!subRes?.length) throw new BadRequestException('Subscription not found');
      if (!['active', 'paused'].includes(subRes[0].status)) throw new BadRequestException('Subscription is not active');

      // Insert skip date (idempotent)
      await this.db.query(
        `INSERT INTO subscription_skip_dates (subscription_id, skip_date, created_by, reason)
         VALUES ($1, $2::date, $3, 'customer_skip')
         ON CONFLICT (subscription_id, skip_date) DO NOTHING`,
        [subscriptionId, date, userId],
      );

      // If order already generated for this date, delete it
      const deletedOrders = await this.db.query(
        `DELETE FROM orders
         WHERE subscription_id = $1
           AND scheduled_date = $2::date
           AND status IN ('placed', 'confirmed')
         RETURNING order_id`,
        [subscriptionId, date],
      );

      // Also mark in overrides with 0 qty
      await this.db.query(
        `INSERT INTO subscription_overrides (subscription_item_id, override_date, m_quantity, e_quantity, override_type, notes, created_at)
         SELECT subscription_item_id, $2::date, 0, 0, 'skip', 'Customer skip', NOW()
         FROM subscription_items
         WHERE subscription_id = $1 AND status = 'active'
         ON CONFLICT DO NOTHING`,
        [subscriptionId, date],
      );

      return {
        status: true,
        message: `Delivery skipped for ${date}`,
        orders_removed: (deletedOrders || []).length,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('skipDelivery error', { error, subscriptionId, date });
      throw new BadRequestException('Failed to skip delivery');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUANTITY OVERRIDE FOR A DATE
  // Customer changes quantity for a specific future date
  // ─────────────────────────────────────────────────────────────────────────
  async overrideQuantity(
    subscriptionId: string,
    body: { date: string; item_id?: string; m_quantity?: number; e_quantity?: number },
    userId: string,
  ) {
    try {
      const { date, item_id } = body;
      const m_qty = Math.max(0, Number(body.m_quantity ?? 0));
      const e_qty = Math.max(0, Number(body.e_quantity ?? 0));

      if (!date) throw new BadRequestException('date is required');

      const istOffset = 5.5 * 60 * 60 * 1000;
      const nowIST = new Date(Date.now() + istOffset);
      const todayStr = nowIST.toISOString().slice(0, 10);
      if (date <= todayStr) throw new BadRequestException('Can only modify future dates');

      const tomorrow = new Date(nowIST);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (date === tomorrow.toISOString().slice(0, 10) && nowIST.getUTCHours() >= 22) {
        throw new BadRequestException('Cutoff passed (10 PM IST) — too late to change tomorrow\'s delivery');
      }

      // Get subscription items
      const itemsQuery = item_id
        ? `SELECT subscription_item_id FROM subscription_items WHERE subscription_id = $1 AND subscription_item_id = $2 AND status = 'active'`
        : `SELECT subscription_item_id FROM subscription_items WHERE subscription_id = $1 AND status = 'active'`;
      const itemsParams = item_id ? [subscriptionId, item_id] : [subscriptionId];
      const items = await this.db.query(itemsQuery, itemsParams);

      if (!items?.length) throw new BadRequestException('No active subscription items found');

      for (const item of items) {
        await this.db.query(
          `INSERT INTO subscription_overrides (subscription_item_id, override_date, m_quantity, e_quantity, override_type, notes, created_at)
           VALUES ($1, $2::date, $3, $4, 'quantity_change', $5, NOW())
           ON CONFLICT (subscription_item_id, override_date)
           DO UPDATE SET m_quantity = EXCLUDED.m_quantity, e_quantity = EXCLUDED.e_quantity, notes = EXCLUDED.notes`,
          [item.subscription_item_id, date, m_qty, e_qty, `Modified by customer ${userId}`],
        );
      }

      // If order already exists for this date, update it
      const existingOrder = await this.db.query(
        `SELECT o.order_id, oi.order_item_id, oi.variant_id 
         FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
         WHERE o.subscription_id = $1 AND o.scheduled_date = $2::date AND o.status IN ('placed','confirmed')`,
        [subscriptionId, date],
      );

      for (const row of (existingOrder || [])) {
        const newQty = m_qty + e_qty;
        if (newQty > 0) {
          await this.db.query(
            `UPDATE order_items SET quantity = $1, updated_at = NOW() WHERE order_item_id = $2`,
            [newQty, row.order_item_id],
          );
        }
      }

      return {
        status: true,
        message: `Quantity updated for ${date}`,
        m_quantity: m_qty,
        e_quantity: e_qty,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('overrideQuantity error', { error, subscriptionId });
      throw new BadRequestException('Failed to update quantity');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOMORROW PREVIEW
  // Returns what will be delivered tomorrow, with skip/modify options
  // ─────────────────────────────────────────────────────────────────────────
  async getTomorrowPreview(subscriptionId: string) {
    try {
      const istOffset = 5.5 * 60 * 60 * 1000;
      const nowIST = new Date(Date.now() + istOffset);
      const tomorrow = new Date(nowIST);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      const hourIST = nowIST.getUTCHours();
      const pastCutoff = hourIST >= 22;

      // Check skip
      const skipRes = await this.db.query(
        `SELECT id FROM subscription_skip_dates WHERE subscription_id = $1 AND skip_date = $2::date`,
        [subscriptionId, tomorrowStr],
      );
      const isSkipped = (skipRes || []).length > 0;

      // Get items with overrides
      const items = await this.db.query(
        `SELECT
           si.subscription_item_id, si.product_variant_id,
           pv.name AS product_name, pv.unit_value, pv.unit_type,
           pi.url AS image_url,
           COALESCE(so.m_quantity, sws.m_quantity, si.default_m_quantity, 0) AS m_quantity,
           COALESCE(so.e_quantity, sws.e_quantity, si.default_e_quantity, 0) AS e_quantity,
           so.override_type
         FROM subscription_items si
         JOIN product_variants pv ON pv.variant_id = si.product_variant_id
         LEFT JOIN product_images pi ON pi.variant_id = pv.variant_id AND pi.sort_order = 1
         LEFT JOIN subscription_weekly_schedule sws
           ON sws.subscription_item_id = si.subscription_item_id
           AND sws.day_of_week = EXTRACT(DOW FROM $2::date)::int
           AND (sws.deleted_at IS NULL)
         LEFT JOIN subscription_overrides so
           ON so.subscription_item_id = si.subscription_item_id
           AND so.override_date = $2::date
         WHERE si.subscription_id = $1 AND si.status = 'active'`,
        [subscriptionId, tomorrowStr],
      );

      return {
        status: true,
        date: tomorrowStr,
        is_skipped: isSkipped,
        past_cutoff: pastCutoff,
        cutoff_time: '22:00 IST',
        can_modify: !pastCutoff && !isSkipped,
        items: items || [],
      };
    } catch (error) {
      this.developer.error('getTomorrowPreview error', { error, subscriptionId });
      throw new BadRequestException('Failed to get tomorrow preview');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ENHANCED CALENDAR — with delivery status history
  // ─────────────────────────────────────────────────────────────────────────
  async getEnhancedCalendar(subscriptionId: string, month?: string) {
    try {
      const now = new Date();
      const targetMonth = month || now.toISOString().slice(0, 7);
      const startDate = `${targetMonth}-01`;
      const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0)
        .toISOString().slice(0, 10);

      // Get all days from subscription_daily_snapshots
      const snapshots = await this.db.query(
        `SELECT snapshot_date::text AS date, delivery_status, billing_status,
                m_final_qty, e_final_qty, product_variant_id
         FROM subscription_daily_snapshots
         WHERE subscription_id = $1
           AND snapshot_date BETWEEN $2::date AND $3::date
         ORDER BY snapshot_date`,
        [subscriptionId, startDate, endDate],
      );

      // Get skip dates
      const skips = await this.db.query(
        `SELECT skip_date::text AS date FROM subscription_skip_dates
         WHERE subscription_id = $1 AND skip_date BETWEEN $2::date AND $3::date`,
        [subscriptionId, startDate, endDate],
      );

      // Get pauses
      const pauses = await this.db.query(
        `SELECT start_date::text, end_date::text FROM subscription_pauses
         WHERE subscription_id = $1
           AND end_date >= $2::date AND start_date <= $3::date`,
        [subscriptionId, startDate, endDate],
      );

      // Get delivered orders
      const delivered = await this.db.query(
        `SELECT o.scheduled_date::text AS date, o.status, o.order_id
         FROM orders o
         WHERE o.subscription_id = $1
           AND o.scheduled_date BETWEEN $2::date AND $3::date`,
        [subscriptionId, startDate, endDate],
      );

      // Build skip set and pause set
      const skipDates = new Set((skips || []).map((s: any) => s.date));
      const pausedRanges = pauses || [];
      const isPaused = (date: string) => pausedRanges.some((p: any) => date >= p.start_date && date <= p.end_date);
      const deliveredMap = new Map((delivered || []).map((d: any) => [d.date, d]));

      // Build calendar days
      const calendar: any[] = [];
      const today = now.toISOString().slice(0, 10);
      const current = new Date(startDate);
      const end = new Date(endDate);

      while (current <= end) {
        const dateStr = current.toISOString().slice(0, 10);
        const deliveredOrder = deliveredMap.get(dateStr);
        let status = 'upcoming';

        if (dateStr < today) {
          if (deliveredOrder?.status === 'delivered') status = 'delivered';
          else if (skipDates.has(dateStr)) status = 'skipped';
          else if (isPaused(dateStr)) status = 'paused';
          else if (deliveredOrder?.status === 'failed') status = 'failed';
          else if (dateStr < today) status = 'missed';
        } else {
          if (skipDates.has(dateStr)) status = 'skipped';
          else if (isPaused(dateStr)) status = 'paused';
          else status = 'upcoming';
        }

        calendar.push({
          date: dateStr,
          status,
          order_id: deliveredOrder?.order_id || null,
        });

        current.setDate(current.getDate() + 1);
      }

      const stats = {
        delivered: calendar.filter(d => d.status === 'delivered').length,
        skipped: calendar.filter(d => d.status === 'skipped').length,
        paused: calendar.filter(d => d.status === 'paused').length,
        upcoming: calendar.filter(d => d.status === 'upcoming').length,
        failed: calendar.filter(d => d.status === 'failed').length,
        missed: calendar.filter(d => d.status === 'missed').length,
      };

      return { status: true, month: targetMonth, calendar, stats };
    } catch (error) {
      this.developer.error('getEnhancedCalendar error', { error, subscriptionId });
      throw new BadRequestException('Failed to get calendar');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADD PRODUCT ITEM TO SUBSCRIPTION
  // ─────────────────────────────────────────────────────────────────────────
  async addSubscriptionItem(
    subscriptionId: string,
    body: { product_variant_id: string; m_quantity: number; e_quantity: number; unit_price?: number },
    userId: string,
  ) {
    try {
      if (!body.product_variant_id) throw new BadRequestException('product_variant_id is required');
      const mQty = Math.max(0, Number(body.m_quantity ?? 0));
      const eQty = Math.max(0, Number(body.e_quantity ?? 0));
      if (mQty + eQty <= 0) throw new BadRequestException('At least one quantity must be > 0');

      // Check subscription exists
      const sub = await this.db.query(
        `SELECT subscription_id, status FROM subscriptions WHERE subscription_id = $1`,
        [subscriptionId],
      );
      if (!sub?.length) throw new BadRequestException('Subscription not found');
      if (sub[0].status !== 'active') throw new BadRequestException('Subscription must be active to add items');

      // Get variant price
      const variant = await this.db.query(
        `SELECT subscription_price, price FROM product_variants WHERE variant_id = $1`,
        [body.product_variant_id],
      );
      if (!variant?.length) throw new BadRequestException('Product variant not found');
      const price = body.unit_price || variant[0].subscription_price || variant[0].price || 0;

      const itemId = `SUBITEM${Date.now().toString(36).toUpperCase()}`;
      const today = new Date().toISOString().slice(0, 10);

      await this.db.transaction(async (client) => {
        // Insert subscription_item
        await client.query(
          `INSERT INTO subscription_items
            (subscription_item_id, subscription_id, product_variant_id, unit_price, final_price,
             default_m_quantity, default_e_quantity, status, start_date, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $4, $5, $6, 'active', $7, NOW(), NOW())`,
          [itemId, subscriptionId, body.product_variant_id, price, mQty, eQty, today],
        );

        // Insert weekly schedule for all 7 days with the given quantities
        for (let day = 0; day <= 6; day++) {
          await client.query(
            `INSERT INTO subscription_weekly_schedule
              (subscription_item_id, subscription_id, day_of_week, m_quantity, e_quantity, effective_from, created_at)
             VALUES ($1, $2, $3, $4, $5, $6::date, NOW())
             ON CONFLICT DO NOTHING`,
            [itemId, subscriptionId, day, mQty, eQty, today],
          );
        }
      });

      return { status: true, message: 'Product added to subscription', item_id: itemId };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('addSubscriptionItem error', { error, subscriptionId });
      throw new BadRequestException('Failed to add item to subscription');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHANGE DELIVERY ADDRESS
  // ─────────────────────────────────────────────────────────────────────────
  async changeAddress(subscriptionId: string, addressId: string, userId: string) {
    try {
      if (!addressId) throw new BadRequestException('address_id is required');

      // Verify address belongs to customer via subscription → customer
      const addr = await this.db.query(
        `SELECT ca.address_id FROM customer_addresses ca
         JOIN subscriptions s ON s.customer_id = ca.customer_id
         WHERE s.subscription_id = $1 AND ca.address_id = $2`,
        [subscriptionId, addressId],
      );
      if (!addr?.length) throw new BadRequestException('Address not found or does not belong to this customer');

      await this.db.query(
        `UPDATE subscriptions SET address_id = $1, updated_at = NOW() WHERE subscription_id = $2`,
        [addressId, subscriptionId],
      );

      // Also update any future pending orders for this subscription
      await this.db.query(
        `UPDATE orders SET address_id = $1, updated_at = NOW()
         WHERE subscription_id = $2
           AND scheduled_date > CURRENT_DATE
           AND status IN ('placed','confirmed')`,
        [addressId, subscriptionId],
      );

      return { status: true, message: 'Delivery address updated' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('changeAddress error', { error, subscriptionId });
      throw new BadRequestException('Failed to change address');
    }
  }
}
