import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly dataService: DataService,
    private readonly databaseService: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  async getSubscriptionView(subscriptionId: string) {
    try {
      const rows = await this.databaseService.query(
        `SELECT s.*,
                u.first_name || ' ' || u.last_name AS customer_name,
                u.phone AS phone,
                u.email AS customer_email,
                c.wallet_balance
         FROM subscriptions s
         LEFT JOIN users u ON u.user_id = s.customer_id
         LEFT JOIN customers c ON c.customer_id = s.customer_id
         WHERE s.id::text = $1 OR s.subscription_id = $1 OR s.subscription_number = $1
         LIMIT 1`,
        [subscriptionId],
      );

      return {
        status: true,
        data: rows[0] ?? null,
        message: rows[0] ? 'Subscription fetched' : 'Subscription not found',
      };
    } catch (error) {
      this.developer.error('getSubscriptionView error', {
        error,
        subscriptionId,
      });
      throw new InternalServerErrorException('Failed to retrieve subscription');
    }
  }

  async getSubscriptionItems(subscriptionId: string) {
    try {
      const rows = await this.databaseService.query(
        `SELECT
          si.id,
          si.subscription_item_id,
          si.subscription_id,
          si.product_variant_id,
          p.name AS product_name,
          pv.name AS variant_name,
          pv.unit_value,
          pv.unit_type,
          COALESCE(MAX(ws.m_quantity), 0)::numeric AS daily_m_quantity,
          COALESCE(MAX(ws.e_quantity), 0)::numeric AS daily_e_quantity,
          COALESCE(SUM(ws.m_quantity), 0)::numeric AS total_m_quantity,
          COALESCE(SUM(ws.e_quantity), 0)::numeric AS total_e_quantity,
          si.unit_price,
          si.discount_id,
          si.coupon_id,
          si.discount_amount,
          si.coupon_amount,
          si.final_price,
          si.is_free,
          si.status,
          si.created_at
         FROM subscription_items si
         LEFT JOIN product_variants pv ON pv.variant_id = si.product_variant_id
         LEFT JOIN products p ON p.product_id = pv.product_id
         LEFT JOIN subscription_weekly_schedule ws ON (ws.subscription_item_id = si.subscription_item_id OR ws.subscription_item_id = si.id::text)
         WHERE si.subscription_id = $1
            OR si.subscription_id IN (
              SELECT subscription_id FROM subscriptions WHERE id::text = $1 OR subscription_number = $1 OR subscription_id = $1
            )
         GROUP BY
          si.id, si.subscription_item_id, si.subscription_id, si.product_variant_id,
          p.name, pv.name, pv.unit_value, pv.unit_type, si.unit_price, si.discount_id, si.coupon_id,
          si.discount_amount, si.coupon_amount, si.final_price, si.is_free, si.status, si.created_at
         ORDER BY si.id ASC`,
        [subscriptionId],
      );

      return {
        status: true,
        data: rows,
        message: 'Subscription items fetched',
      };
    } catch (error) {
      this.developer.error('getSubscriptionItems error', {
        error,
        subscriptionId,
      });
      throw new InternalServerErrorException(
        'Failed to retrieve subscription items',
      );
    }
  }

  async deleteSubscription(subscriptionId: string, adminId: string) {
    try {
      const now = new Date().toISOString();

      const result = await this.dataService.query('subscriptions', {
        update: {
          status: 'cancelled',
          cancelled_at: now,
          updated_at: now,
          updated_by: adminId,
        },
        where: [{ column: 'id', operator: '=', value: subscriptionId }],
      });

      if (!result?.status) {
        throw new InternalServerErrorException('Database update failed');
      }

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'subscription_delete',
        target_type: 'subscription',
        target_id: subscriptionId,
        details: JSON.stringify({ action: 'soft_delete_to_cancelled' }),
      });

      return {
        status: true,
        message: 'Subscription moved to cancelled status',
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      this.developer.error('deleteSubscription error', {
        error,
        subscriptionId,
      });
      throw new InternalServerErrorException('Failed to delete subscription');
    }
  }

  async getSubscriptionOverrideView(overrideId: string) {
    try {
      const result = await this.dataService.query('subscription_overrides', {
        select: [
          'subscription_overrides.*',
          'subscription_items.subscription_id',
          'subscription_items.product_variant_id',
          'products.name AS product_name',
          'product_variants.name AS variant_name',
        ],
        joins: [
          {
            type: 'inner',
            table: 'subscription_items',
            on: [
              [
                'subscription_overrides.subscription_item_id',
                'subscription_items.id',
              ],
            ],
          },
          {
            type: 'inner',
            table: 'product_variants',
            on: [
              [
                'subscription_items.product_variant_id',
                'product_variants.variant_id',
              ],
            ],
          },
          {
            type: 'inner',
            table: 'products',
            on: [['product_variants.product_id', 'products.product_id']],
          },
        ],
        where: [
          { column: 'subscription_overrides.id', operator: '=', value: overrideId },
          { column: 'products.is_subscribable', operator: '=', value: true },
        ],
        limit: 1,
      });

      return {
        status: true,
        data: result?.data?.[0] ?? null,
        message: result?.data?.[0]
          ? 'Subscription override fetched'
          : 'Subscription override not found',
      };
    } catch (error) {
      this.developer.error('getSubscriptionOverrideView error', {
        error,
        overrideId,
      });
      throw new InternalServerErrorException(
        'Failed to retrieve subscription override',
      );
    }
  }

  async deleteSubscriptionOverride(overrideId: string, adminId: string) {
    try {
      const existing = await this.getSubscriptionOverrideView(overrideId);
      if (!existing.data) {
        return {
          status: false,
          message: 'Subscription override not found',
        };
      }

      const result = await this.dataService.query('subscription_overrides', {
        delete: true,
        where: [{ column: 'id', operator: '=', value: overrideId }],
      });

      if (!result?.status) {
        throw new InternalServerErrorException('Database delete failed');
      }

      await this.dataService.insert('subscription_logs', {
        subscription_id: existing.data.subscription_id,
        subscription_item_id: existing.data.subscription_item_id,
        action: 'override_delete',
        old_data: JSON.stringify(existing.data),
        new_data: null,
        created_by: adminId,
      });

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'subscription_override_delete',
        target_type: 'subscription_override',
        target_id: overrideId,
        details: JSON.stringify({ table: 'subscription_overrides' }),
      });

      return {
        status: true,
        message: 'Subscription override deleted successfully',
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      this.developer.error('deleteSubscriptionOverride error', {
        error,
        overrideId,
      });
      throw new InternalServerErrorException(
        'Failed to delete subscription override',
      );
    }
  }

  // ────────────────────────────────────────────────
  // Subscription Dashboard Summary
  // ────────────────────────────────────────────────
  async getSubscriptionsSummary(query?: any) {
    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let pIdx = 1;

      const branch = query?.branchId || query?.branch_id || query?.branch;
      if (branch) {
        conditions.push(`s.branch_id = $${pIdx++}`);
        params.push(branch);
      }

      if (query?.date) {
        conditions.push(`(s.start_date IS NULL OR s.start_date <= $${pIdx}) AND (s.end_date IS NULL OR s.end_date >= $${pIdx})`);
        params.push(query.date);
        pIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const sql = `
        SELECT
          COUNT(*)::int                                          AS total,
          COUNT(*) FILTER (WHERE s.status = 'active')::int         AS active,
          COUNT(*) FILTER (WHERE s.status = 'paused')::int         AS paused,
          COUNT(*) FILTER (WHERE s.status = 'expired')::int        AS expired,
          COUNT(*) FILTER (WHERE s.status = 'cancelled')::int      AS cancelled
        FROM subscriptions s
        ${whereClause}
      `;

      const rows = await this.databaseService.query(sql, params);

      return {
        status: true,
        data: rows[0] ?? { total: 0, active: 0, paused: 0, expired: 0, cancelled: 0 },
        message: 'Subscription summary fetched',
      };
    } catch (error) {
      this.developer.error('getSubscriptionsSummary error', { error });
      throw new InternalServerErrorException('Failed to retrieve subscription summary');
    }
  }

  // ────────────────────────────────────────────────
  // Subscription Pause
  // ────────────────────────────────────────────────
  async pauseSubscription(
    subscriptionId: string,
    startDate?: string,
    endDate?: string,
    reason?: string,
    adminId: string = 'system',
  ) {
    this.developer.debug('SubscriptionsService.pauseSubscription called', { subscriptionId, startDate, endDate });
    try {
      return await this.databaseService.transaction(async (client) => {
        const subRes = await client.query<any>(
          `SELECT subscription_id, status, pause_from_date, pause_to_date 
           FROM subscriptions 
           WHERE id::text = $1 OR subscription_id = $1 OR subscription_number = $1
           LIMIT 1`,
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

        await client.query(
          `UPDATE subscriptions
           SET pause_from_date = $1,
               pause_to_date = $2,
               pause_reason = $3,
               updated_by = $4,
               updated_at = now()
           WHERE subscription_id = $5`,
          [startStr, endStr, reason || 'Admin vacation pause', adminId, sub.subscription_id],
        );

        await client.query(
          `INSERT INTO subscription_pauses (subscription_id, start_date, end_date, status, reason, created_at, updated_at)
           VALUES ($1, $2, $3, 'paused', $4, now(), now())`,
          [sub.subscription_id, startStr, endStr, reason || 'Admin vacation pause'],
        );

        await client.query(
          `INSERT INTO subscription_logs (subscription_id, action, new_data, created_by, created_at)
           VALUES ($1, 'pause', $2, $3, now())`,
          [sub.subscription_id, JSON.stringify({ paused_from: startStr, paused_to: endStr, reason }), adminId],
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

  // ────────────────────────────────────────────────
  // Subscription Resume — 3-Scenario Logic
  // ────────────────────────────────────────────────
  async resumeSubscription(
    subscriptionId: string,
    requestedResumeDate?: string,
    adminId: string = 'system',
  ) {
    this.developer.debug('SubscriptionsService.resumeSubscription called', { subscriptionId, requestedResumeDate });
    try {
      return await this.databaseService.transaction(async (client) => {
        const subRes = await client.query<any>(
          `SELECT subscription_id, status, pause_from_date, pause_to_date, auto_renew 
           FROM subscriptions 
           WHERE id::text = $1 OR subscription_id = $1 OR subscription_number = $1
           LIMIT 1`,
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

        if (!pFrom || !pTo || pTo < todayStr) {
          throw new BadRequestException('Subscription is not currently paused');
        }

        const pauseRes = await client.query<any>(
          `SELECT id, start_date, end_date, status, reason
           FROM subscription_pauses
           WHERE subscription_id = $1 AND status = 'paused' AND deleted_at IS NULL
           ORDER BY created_at DESC NULLS LAST, id DESC
           LIMIT 1`,
          [sub.subscription_id],
        );
        const activePause = pauseRes.rows[0];
        if (!activePause) throw new BadRequestException('No active pause record found to resume');

        const activePauseEnd = String(activePause.end_date).slice(0, 10);

        // Scenario 1: Resume before pause starts
        if (todayStr < pFrom) {
          await client.query(
            `UPDATE subscriptions 
             SET pause_from_date = NULL, 
                 pause_to_date = NULL, 
                 pause_reason = NULL,
                 updated_by = $1,
                 updated_at = now() 
             WHERE subscription_id = $2`,
            [adminId, sub.subscription_id],
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
            [sub.subscription_id],
          );

          await client.query(
            `INSERT INTO subscription_logs (subscription_id, action, new_data, created_by, created_at)
             VALUES ($1, 'resume_before_start', $2, $3, now())`,
            [sub.subscription_id, JSON.stringify({ resumed_at: todayStr, scenario: 1 }), adminId],
          );

          return {
            status: true,
            message: 'Upcoming pause cancelled. Regular deliveries will continue without interruption.',
            scenario: 1,
          };
        }

        // Scenario 2 & 3: Resume during pause
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

        const rObj = new Date(resumeDate + 'T00:00:00Z');
        rObj.setUTCDate(rObj.getUTCDate() - 1);
        const dayBeforeResumeStr = rObj.toISOString().slice(0, 10);

        if (dayBeforeResumeStr < pFrom) {
          await client.query(
            `UPDATE subscriptions 
             SET pause_from_date = NULL, 
                 pause_to_date = NULL, 
                 pause_reason = NULL,
                 updated_by = $1,
                 updated_at = now() 
             WHERE subscription_id = $2`,
            [adminId, sub.subscription_id],
          );
          await client.query(
            `UPDATE subscription_pauses 
             SET status = 'resumed', 
                 updated_at = now() 
             WHERE id = $1`,
            [activePause.id],
          );
        } else {
          await client.query(
            `UPDATE subscriptions 
             SET pause_to_date = $1, 
                 updated_by = $2,
                 updated_at = now() 
             WHERE subscription_id = $3`,
            [dayBeforeResumeStr, adminId, sub.subscription_id],
          );

          await client.query(
            `UPDATE subscription_pauses 
             SET end_date = $1, 
                 updated_at = now() 
             WHERE id = $2`,
            [dayBeforeResumeStr, activePause.id],
          );

          await client.query(
            `INSERT INTO subscription_pauses (subscription_id, start_date, end_date, status, reason, created_at, updated_at)
             VALUES ($1, $2, $3, 'resumed', $4, now(), now())`,
            [
              sub.subscription_id,
              resumeDate,
              activePauseEnd,
              `Resumed on ${resumeDate}`,
            ],
          );
        }

        await client.query(
          `UPDATE subscription_items SET status = 'active', updated_at = now() WHERE subscription_id = $1 AND status = 'paused'`,
          [sub.subscription_id],
        );

        await client.query(
          `INSERT INTO subscription_logs (subscription_id, action, new_data, created_by, created_at)
           VALUES ($1, 'resume', $2, $3, now())`,
          [sub.subscription_id, JSON.stringify({ resumed_at: todayStr, resume_date: resumeDate }), adminId],
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

  // ────────────────────────────────────────────────
  // Pause History
  // ────────────────────────────────────────────────
  async getPauseHistory(subscriptionId: string) {
    this.developer.debug('SubscriptionsService.getPauseHistory called', { subscriptionId });
    try {
      const rows = await this.databaseService.query(
        `SELECT sp.id, sp.subscription_id, sp.start_date, sp.end_date, sp.status, sp.reason, sp.created_at, sp.updated_at
         FROM subscription_pauses sp
         JOIN subscriptions s ON s.subscription_id = sp.subscription_id
         WHERE (s.id::text = $1 OR s.subscription_id = $1 OR s.subscription_number = $1)
           AND sp.deleted_at IS NULL
         ORDER BY sp.created_at DESC NULLS LAST, sp.id DESC`,
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

  // ────────────────────────────────────────────────
  // Auto Renew Toggle
  // ────────────────────────────────────────────────
  async updateAutoRenew(subscriptionId: string, autoRenew: boolean, adminId: string = 'system') {
    this.developer.debug('SubscriptionsService.updateAutoRenew called', { subscriptionId, autoRenew });
    try {
      const rows = await this.databaseService.query(
        `UPDATE subscriptions
         SET auto_renew = $1, updated_by = $2, updated_at = now()
         WHERE id::text = $3 OR subscription_id = $3 OR subscription_number = $3
         RETURNING subscription_id, auto_renew, updated_at`,
        [Boolean(autoRenew), adminId, subscriptionId],
      );
      const updated = Array.isArray(rows) ? rows[0] : null;
      if (!updated) throw new BadRequestException('Subscription not found');

      await this.databaseService.query(
        `INSERT INTO subscription_logs (subscription_id, action, new_data, created_by, created_at)
         VALUES ($1, 'update_auto_renew', $2, $3, now())`,
        [updated.subscription_id, JSON.stringify({ auto_renew: Boolean(autoRenew) }), adminId],
      );

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
}