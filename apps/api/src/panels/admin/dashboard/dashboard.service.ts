import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../../shared/database/Database.service';
import { DeveloperService } from '../../../shared/logger/Developer.service';

function todayIST(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  // ────────────────────────────────────────────────
  // Main KPI Dashboard — single optimized query
  // ────────────────────────────────────────────────
  async getKpis() {
    try {
      const today = todayIST();

      const sql = `
        WITH customer_stats AS (
          SELECT
            COUNT(*)::int                                          AS total_customers,
            COUNT(*) FILTER (WHERE customer_status = 'active')::int        AS active_customers,
            COUNT(*) FILTER (WHERE created_at::date >= CURRENT_DATE - INTERVAL '7 days')::int AS new_customers_7d,
            COUNT(*) FILTER (WHERE created_at::date >= CURRENT_DATE - INTERVAL '30 days')::int AS new_customers_30d
          FROM customers
        ),
        subscription_stats AS (
          SELECT
            COUNT(*)::int                                          AS total_subscriptions,
            COUNT(*) FILTER (WHERE status = 'active')::int        AS active_subscriptions,
            COUNT(*) FILTER (WHERE status = 'paused')::int        AS paused_subscriptions,
            COUNT(*) FILTER (WHERE created_at::date >= CURRENT_DATE - INTERVAL '7 days')::int AS new_subscriptions_7d
          FROM subscriptions
        ),
        today_orders AS (
          SELECT
            COUNT(*)::int                                              AS today_total,
            COUNT(*) FILTER (WHERE status = 'pending')::int            AS today_pending,
            COUNT(*) FILTER (WHERE status = 'placed')::int             AS today_placed,
            COUNT(*) FILTER (WHERE status = 'confirmed')::int          AS today_confirmed,
            COUNT(*) FILTER (WHERE status = 'packed')::int             AS today_packed,
            COUNT(*) FILTER (WHERE status = 'out_for_delivery')::int   AS today_out_for_delivery,
            COUNT(*) FILTER (WHERE status = 'delivered')::int          AS today_delivered,
            COUNT(*) FILTER (WHERE status = 'cancelled')::int          AS today_cancelled,
            COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled'), 0)::numeric AS today_revenue,
            COUNT(*) FILTER (WHERE order_source = 'subscription')::int AS today_subscription_orders,
            COUNT(*) FILTER (WHERE order_source = 'one-time')::int     AS today_onetime_orders
          FROM orders
          WHERE scheduled_date = $1
        ),
        overall_revenue AS (
          SELECT
            COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled'), 0)::numeric AS total_revenue,
            COALESCE(SUM(total_amount) FILTER (
              WHERE status != 'cancelled'
                AND scheduled_date >= CURRENT_DATE - INTERVAL '30 days'
            ), 0)::numeric AS revenue_30d,
            COALESCE(SUM(total_amount) FILTER (
              WHERE status != 'cancelled'
                AND scheduled_date >= CURRENT_DATE - INTERVAL '7 days'
            ), 0)::numeric AS revenue_7d
          FROM orders
        ),
        delivery_stats AS (
          SELECT
            COUNT(*)::int                                          AS total_delivery_partners,
            COUNT(*) FILTER (WHERE is_active = true)::int          AS active_delivery_partners
          FROM delivery_partners
        ),
        wallet_stats AS (
          SELECT
            COALESCE(SUM(wallet_balance), 0)::numeric AS total_wallet_balance,
            COUNT(*) FILTER (WHERE wallet_balance > 0)::int AS wallets_with_balance
          FROM customers
        ),
        inventory_stats AS (
          SELECT
            COUNT(*)::int AS total_variants,
            COUNT(*) FILTER (WHERE stock <= low_stock_threshold AND stock >= 0)::int AS low_stock_count,
            COUNT(*) FILTER (WHERE stock <= 0)::int AS out_of_stock_count
          FROM product_variants
          WHERE status = 'active'
        ),
        pending_deliveries AS (
          SELECT COUNT(*)::int AS pending_delivery_count
          FROM orders
          WHERE status IN ('out_for_delivery', 'packed', 'confirmed')
            AND scheduled_date = $1
        )
        SELECT
          cs.*,
          ss.*,
          tod.*,
          rev.*,
          ds.*,
          ws.*,
          invs.*,
          pd.*
        FROM customer_stats cs
        CROSS JOIN subscription_stats ss
        CROSS JOIN today_orders tod
        CROSS JOIN overall_revenue rev
        CROSS JOIN delivery_stats ds
        CROSS JOIN wallet_stats ws
        CROSS JOIN inventory_stats invs
        CROSS JOIN pending_deliveries pd
      `;

      const rows = await this.db.query(sql, [today]);
      const kpi = rows[0] ?? {};

      return {
        status: true,
        data: {
          // Customer KPIs
          total_customers: kpi.total_customers ?? 0,
          active_customers: kpi.active_customers ?? 0,
          new_customers_7d: kpi.new_customers_7d ?? 0,
          new_customers_30d: kpi.new_customers_30d ?? 0,

          // Subscription KPIs
          active_subscriptions: kpi.active_subscriptions ?? 0,
          paused_subscriptions: kpi.paused_subscriptions ?? 0,
          total_subscriptions: kpi.total_subscriptions ?? 0,
          new_subscriptions_7d: kpi.new_subscriptions_7d ?? 0,

          // Today's Orders
          today_total: kpi.today_total ?? 0,
          today_pending: kpi.today_pending ?? 0,
          today_placed: kpi.today_placed ?? 0,
          today_confirmed: kpi.today_confirmed ?? 0,
          today_packed: kpi.today_packed ?? 0,
          today_out_for_delivery: kpi.today_out_for_delivery ?? 0,
          today_delivered: kpi.today_delivered ?? 0,
          today_cancelled: kpi.today_cancelled ?? 0,
          today_revenue: Number(kpi.today_revenue ?? 0),
          today_subscription_orders: kpi.today_subscription_orders ?? 0,
          today_onetime_orders: kpi.today_onetime_orders ?? 0,

          // Revenue
          total_revenue: Number(kpi.total_revenue ?? 0),
          revenue_30d: Number(kpi.revenue_30d ?? 0),
          revenue_7d: Number(kpi.revenue_7d ?? 0),

          // Delivery
          total_delivery_partners: kpi.total_delivery_partners ?? 0,
          active_delivery_partners: kpi.active_delivery_partners ?? 0,
          pending_delivery_count: kpi.pending_delivery_count ?? 0,

          // Wallet
          total_wallet_balance: Number(kpi.total_wallet_balance ?? 0),
          wallets_with_balance: kpi.wallets_with_balance ?? 0,

          // Inventory
          total_variants: kpi.total_variants ?? 0,
          low_stock_count: kpi.low_stock_count ?? 0,
          out_of_stock_count: kpi.out_of_stock_count ?? 0,

          // Meta
          date: today,
        },
        message: 'Dashboard KPIs fetched',
      };
    } catch (error) {
      this.developer.error('getKpis error', { error });
      throw new InternalServerErrorException('Failed to retrieve dashboard KPIs');
    }
  }

  // ────────────────────────────────────────────────
  // Branch Performance
  // ────────────────────────────────────────────────
  async getBranchPerformance(days: number = 30) {
    try {
      const sql = `
        SELECT
          b.branch_id,
          b.branch_name,
          COUNT(o.order_id)::int                                           AS total_orders,
          COUNT(o.order_id) FILTER (WHERE o.status = 'delivered')::int     AS delivered_orders,
          COUNT(o.order_id) FILTER (WHERE o.status = 'cancelled')::int     AS cancelled_orders,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status != 'cancelled'), 0)::numeric AS revenue,
          COUNT(DISTINCT o.customer_id)::int                               AS unique_customers,
          ROUND(
            COUNT(o.order_id) FILTER (WHERE o.status = 'delivered')::numeric /
            NULLIF(COUNT(o.order_id) FILTER (WHERE o.status != 'cancelled'), 0) * 100,
            1
          )::numeric                                                       AS delivery_rate
        FROM branches b
        LEFT JOIN orders o ON o.branch_id = b.branch_id
          AND o.scheduled_date >= CURRENT_DATE - ($1 || ' days')::interval
        GROUP BY b.branch_id, b.branch_name
        ORDER BY revenue DESC
      `;

      const rows = await this.db.query(sql, [days]);

      return {
        status: true,
        data: rows.map((r: any) => ({
          ...r,
          revenue: Number(r.revenue ?? 0),
          delivery_rate: Number(r.delivery_rate ?? 0),
        })),
        message: 'Branch performance fetched',
      };
    } catch (error) {
      this.developer.error('getBranchPerformance error', { error });
      throw new InternalServerErrorException('Failed to retrieve branch performance');
    }
  }

  // ────────────────────────────────────────────────
  // Growth Metrics (daily trend)
  // ────────────────────────────────────────────────
  async getGrowthMetrics(days: number = 7) {
    try {
      const sql = `
        WITH date_series AS (
          SELECT generate_series(
            CURRENT_DATE - ($1 || ' days')::interval,
            CURRENT_DATE,
            '1 day'::interval
          )::date AS day
        ),
        daily_orders AS (
          SELECT
            scheduled_date AS day,
            COUNT(*)::int AS orders,
            COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled'), 0)::numeric AS revenue
          FROM orders
          WHERE scheduled_date >= CURRENT_DATE - ($1 || ' days')::interval
          GROUP BY scheduled_date
        ),
        daily_customers AS (
          SELECT
            created_at::date AS day,
            COUNT(*)::int AS new_customers
          FROM customers
          WHERE created_at::date >= CURRENT_DATE - ($1 || ' days')::interval
          GROUP BY created_at::date
        ),
        daily_subscriptions AS (
          SELECT
            created_at::date AS day,
            COUNT(*)::int AS new_subscriptions
          FROM subscriptions
          WHERE created_at::date >= CURRENT_DATE - ($1 || ' days')::interval
          GROUP BY created_at::date
        )
        SELECT
          ds.day,
          COALESCE(do2.orders, 0)::int AS orders,
          COALESCE(do2.revenue, 0)::numeric AS revenue,
          COALESCE(dc.new_customers, 0)::int AS new_customers,
          COALESCE(dsub.new_subscriptions, 0)::int AS new_subscriptions
        FROM date_series ds
        LEFT JOIN daily_orders do2 ON do2.day = ds.day
        LEFT JOIN daily_customers dc ON dc.day = ds.day
        LEFT JOIN daily_subscriptions dsub ON dsub.day = ds.day
        ORDER BY ds.day ASC
      `;

      const rows = await this.db.query(sql, [days]);

      return {
        status: true,
        data: rows.map((r: any) => ({
          day: r.day,
          orders: r.orders,
          revenue: Number(r.revenue ?? 0),
          new_customers: r.new_customers,
          new_subscriptions: r.new_subscriptions,
        })),
        message: 'Growth metrics fetched',
      };
    } catch (error) {
      this.developer.error('getGrowthMetrics error', { error });
      throw new InternalServerErrorException('Failed to retrieve growth metrics');
    }
  }

  // ────────────────────────────────────────────────
  // Active Alerts
  // ────────────────────────────────────────────────
  async getActiveAlerts() {
    try {
      const today = todayIST();
      const alerts: any[] = [];

      // Low stock alerts
      const lowStockSql = `
        SELECT pv.variant_id, p.name AS product_name, pv.name AS variant_name,
               COALESCE(SUM(sb.available_quantity), 0)::numeric AS stock,
               pv.low_stock_threshold
        FROM product_variants pv
        JOIN products p ON p.product_id = pv.product_id
        LEFT JOIN stock_balances sb ON sb.product_variant_id = pv.variant_id AND sb.deleted_at IS NULL
        WHERE pv.status = 'active' AND pv.deleted_at IS NULL
        GROUP BY pv.variant_id, p.name, pv.name, pv.low_stock_threshold
        HAVING COALESCE(SUM(sb.available_quantity), 0) BETWEEN 0 AND pv.low_stock_threshold
        ORDER BY stock ASC
        LIMIT 5
      `;
      const lowStock = await this.db.query(lowStockSql);
      lowStock.forEach((item: any) => {
        alerts.push({
          type: 'warning',
          category: 'inventory',
          title: `Low Stock: ${item.product_name} - ${item.variant_name}`,
          msg: `Only ${item.stock} units left (threshold: ${item.low_stock_threshold})`,
          time: 'Now',
        });
      });

      // Out of stock alerts
      const outOfStockSql = `
        SELECT COUNT(*)::int AS count
        FROM (
          SELECT pv.variant_id
          FROM product_variants pv
          LEFT JOIN stock_balances sb
            ON sb.product_variant_id = pv.variant_id AND sb.deleted_at IS NULL
          WHERE pv.status = 'active' AND pv.deleted_at IS NULL
          GROUP BY pv.variant_id
          HAVING COALESCE(SUM(sb.available_quantity), 0) <= 0
        ) out_of_stock
      `;
      const outOfStock = await this.db.query(outOfStockSql);
      if ((outOfStock[0]?.count ?? 0) > 0) {
        alerts.push({
          type: 'critical',
          category: 'inventory',
          title: `${outOfStock[0].count} products out of stock`,
          msg: 'Immediate restock required',
          time: 'Now',
        });
      }

      // Pending orders that haven't been processed
      const pendingOrdersSql = `
        SELECT COUNT(*)::int AS count
        FROM orders
        WHERE scheduled_date = $1 AND status = 'pending'
          AND created_at < NOW() - INTERVAL '2 hours'
      `;
      const pendingOrders = await this.db.query(pendingOrdersSql, [today]);
      if ((pendingOrders[0]?.count ?? 0) > 0) {
        alerts.push({
          type: 'warning',
          category: 'orders',
          title: `${pendingOrders[0].count} orders pending for 2+ hours`,
          msg: 'Orders need attention for today\'s delivery',
          time: 'Today',
        });
      }

      // Failed delivery orders
      const failedSql = `
        SELECT COUNT(*)::int AS count
        FROM orders
        WHERE scheduled_date = $1 AND status = 'failed'
      `;
      const failed = await this.db.query(failedSql, [today]);
      if ((failed[0]?.count ?? 0) > 0) {
        alerts.push({
          type: 'critical',
          category: 'delivery',
          title: `${failed[0].count} failed deliveries today`,
          msg: 'Review and reassign failed orders',
          time: 'Today',
        });
      }

      return {
        status: true,
        data: alerts,
        message: 'Alerts fetched',
      };
    } catch (error) {
      this.developer.error('getActiveAlerts error', { error });
      throw new InternalServerErrorException('Failed to retrieve alerts');
    }
  }
}
