import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../../shared/database/Database.service';
import { DeveloperService } from '../../../shared/logger/Developer.service';

@Injectable()
export class BranchConfigService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  // ────────────────────────────────────────────────
  // Radius Configuration
  // ────────────────────────────────────────────────
  async getRadiusConfig() {
    try {
      const sql = `
        SELECT
          b.branch_id, b.branch_name, b.delivery_radius_km,
          b.lat, b.lng,
          b.city, b.state,
          (SELECT COUNT(*)::int FROM customer_addresses ca
           WHERE ca.branch_id = b.branch_id) AS customer_count,
          (SELECT COUNT(*)::int FROM delivery_partners db
           WHERE db.branch_id = b.branch_id AND db.is_active = true) AS partner_count
        FROM branches b
        WHERE b.deleted_at IS NULL
        ORDER BY b.branch_name ASC
      `;
      const rows = await this.db.query(sql, []);
      return { status: true, data: rows, message: 'Radius config fetched' };
    } catch (error) {
      this.developer.error('getRadiusConfig error', { error });
      throw new InternalServerErrorException('Failed to retrieve radius config');
    }
  }

  async updateRadiusConfig(branchId: string, body: any) {
    try {
      const updateFields: string[] = ['updated_at = NOW()'];
      const params: any[] = [branchId];

      if (body.delivery_radius_km !== undefined) { params.push(body.delivery_radius_km); updateFields.push(`delivery_radius_km = $${params.length}`); }
      if (body.lat !== undefined) { params.push(body.lat); updateFields.push(`lat = $${params.length}`); }
      if (body.lng !== undefined) { params.push(body.lng); updateFields.push(`lng = $${params.length}`); }

      await this.db.query(
        `UPDATE branches SET ${updateFields.join(', ')} WHERE branch_id = $1`, params,
      );
      return { status: true, message: 'Radius config updated' };
    } catch (error) {
      this.developer.error('updateRadiusConfig error', { error });
      throw new InternalServerErrorException('Failed to update radius config');
    }
  }

  // ────────────────────────────────────────────────
  // Partner Allocation
  // ────────────────────────────────────────────────
  async getPartnerAllocation() {
    try {
      const sql = `
        SELECT
          db.id, db.full_name, db.phone, db.branch_id,
          b.branch_name,
          db.is_active, db.is_available,
          db.max_daily_orders, db.total_runs, db.total_deliveries,
          db.average_rating
        FROM delivery_partners db
        LEFT JOIN branches b ON b.branch_id = db.branch_id
        WHERE db.is_active = true
        ORDER BY b.branch_name ASC, db.full_name ASC
      `;
      const rows = await this.db.query(sql, []);

      // Group by branch
      const byBranch = new Map<string, any>();
      for (const r of rows) {
        const key = r.branch_id || 'unassigned';
        if (!byBranch.has(key)) {
          byBranch.set(key, {
            branch_id: r.branch_id,
            branch_name: r.branch_name || 'Unassigned',
            partners: [],
          });
        }
        byBranch.get(key)!.partners.push(r);
      }

      return {
        status: true,
        data: Array.from(byBranch.values()),
        total_partners: rows.length,
        message: 'Partner allocation fetched',
      };
    } catch (error) {
      this.developer.error('getPartnerAllocation error', { error });
      throw new InternalServerErrorException('Failed to retrieve partner allocation');
    }
  }

  async allocatePartner(partnerId: string, branchId: string) {
    try {
      await this.db.query(
        'UPDATE delivery_partners SET branch_id = $2, updated_at = NOW() WHERE id = $1',
        [partnerId, branchId],
      );
      return { status: true, message: 'Partner allocated to branch' };
    } catch (error) {
      this.developer.error('allocatePartner error', { error });
      throw new InternalServerErrorException('Failed to allocate partner');
    }
  }

  // ────────────────────────────────────────────────
  // Branch Analytics
  // ────────────────────────────────────────────────
  async getBranchAnalytics(query: any) {
    try {
      const days = parseInt(query.days || '30', 10);
      const branchId = query.branch_id;

      const params: any[] = [days];
      const branchFilter = branchId ? `AND o.branch_id = $2` : '';
      if (branchId) params.push(branchId);

      const sql = `
        SELECT
          b.branch_id, b.branch_name,
          COUNT(o.order_id)::int AS total_orders,
          COUNT(o.order_id) FILTER (WHERE o.status = 'delivered')::int AS delivered_orders,
          COUNT(o.order_id) FILTER (WHERE o.status = 'cancelled')::int AS cancelled_orders,
          COUNT(o.order_id) FILTER (WHERE o.status = 'failed')::int AS failed_orders,
          COUNT(DISTINCT o.customer_id)::int AS unique_customers,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'delivered'), 0)::numeric AS revenue,
          COALESCE(
            ROUND(
              COUNT(o.order_id) FILTER (WHERE o.status = 'delivered')::numeric /
              NULLIF(COUNT(o.order_id) FILTER (WHERE o.status NOT IN ('cancelled')), 0) * 100, 1
            ), 0
          )::numeric AS delivery_rate,
          COUNT(DISTINCT dr.id)::int AS total_runs,
          COALESCE(AVG(dr.total_addresses), 0)::numeric AS avg_addresses_per_run,
          (SELECT COUNT(*)::int FROM delivery_partners db
           WHERE db.branch_id = b.branch_id AND db.is_active = true) AS active_partners,
          (SELECT COUNT(*)::int FROM subscriptions s
           WHERE s.branch_id = b.branch_id AND s.status = 'active') AS active_subscriptions
        FROM branches b
        LEFT JOIN orders o ON o.branch_id = b.branch_id
          AND o.scheduled_date >= CURRENT_DATE - ($1 || ' days')::interval
        LEFT JOIN delivery_runs dr ON dr.branch_id = b.branch_id
          AND dr.run_date >= CURRENT_DATE - ($1 || ' days')::interval
        WHERE b.deleted_at IS NULL ${branchFilter}
        GROUP BY b.branch_id, b.branch_name
        ORDER BY revenue DESC
      `;

      const rows = await this.db.query(sql, params);

      // Daily trend for the selected period
      const trendSql = `
        SELECT
          o.scheduled_date::date AS day,
          ${branchId ? '' : "o.branch_id, b.branch_name,"}
          COUNT(o.order_id)::int AS orders,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'delivered'), 0)::numeric AS revenue,
          COUNT(DISTINCT o.customer_id)::int AS customers
        FROM orders o
        ${branchId ? '' : 'LEFT JOIN branches b ON b.branch_id = o.branch_id'}
        WHERE o.scheduled_date >= CURRENT_DATE - ($1 || ' days')::interval
          ${branchFilter}
        GROUP BY o.scheduled_date::date ${branchId ? '' : ', o.branch_id, b.branch_name'}
        ORDER BY day ASC
      `;
      const trend = await this.db.query(trendSql, params);

      return {
        status: true,
        data: { branches: rows, trend },
        days,
        message: 'Branch analytics fetched',
      };
    } catch (error) {
      this.developer.error('getBranchAnalytics error', { error });
      throw new InternalServerErrorException('Failed to retrieve branch analytics');
    }
  }
}
