import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
        `SELECT s.*, COALESCE(c.full_name, CONCAT(c.first_name, ' ', c.last_name)) AS customer_name, COALESCE(c.mobile, c.phone) AS phone, c.wallet_balance
         FROM subscriptions s
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
  async getSubscriptionsSummary() {
    try {
      const sql = `
        SELECT
          COUNT(*)::int                                          AS total,
          COUNT(*) FILTER (WHERE status = 'active')::int         AS active,
          COUNT(*) FILTER (WHERE status = 'paused')::int         AS paused,
          COUNT(*) FILTER (WHERE status = 'expired')::int        AS expired,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int      AS cancelled
        FROM subscriptions
      `;

      const rows = await this.databaseService.query(sql);

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
}