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
            -- customers has no customer_status column; is_blocked is the live
            -- flag, and the app's own block/unblock writes pair is_blocked=true
            -- with 'blocked' and is_blocked=false with 'active'.
            COUNT(*) FILTER (WHERE COALESCE(is_blocked, false) = false)::int AS active_customers,
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
            COUNT(*) FILTER (WHERE status = 'assigned')::int           AS today_assigned,
            COUNT(*) FILTER (WHERE status = 'packed')::int             AS today_packed,
            COUNT(*) FILTER (WHERE status = 'out_for_delivery')::int   AS today_out_for_delivery,
            COUNT(*) FILTER (WHERE status = 'delivered')::int          AS today_delivered,
            COUNT(*) FILTER (WHERE status IN ('failed', 'cancelled'))::int AS today_cancelled,
            COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled', 'failed')), 0)::numeric AS today_revenue,
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
        -- product_variants has no stock column: on-hand quantity lives in
        -- stock_balances, one row per (warehouse_id, product_variant_id). The
        -- rows are collapsed to one per variant first, so a variant stocked in
        -- several warehouses is counted once and judged on its total.
        inventory_stats AS (
          SELECT
            COUNT(*)::int AS total_variants,
            COUNT(*) FILTER (WHERE available_quantity > 0 AND available_quantity <= low_stock_threshold)::int AS low_stock_count,
            COUNT(*) FILTER (WHERE available_quantity <= 0)::int AS out_of_stock_count
          FROM (
            SELECT
              pv.variant_id,
              COALESCE(SUM(sb.available_quantity), 0) AS available_quantity,
              COALESCE(MAX(sb.low_stock_threshold), MAX(pv.low_stock_threshold), 0) AS low_stock_threshold
            FROM product_variants pv
            LEFT JOIN stock_balances sb
              ON sb.product_variant_id = pv.variant_id
             AND sb.deleted_at IS NULL
            WHERE pv.status = 'active'
              AND pv.deleted_at IS NULL
            GROUP BY pv.variant_id
          ) variant_stock
        ),
        pending_deliveries AS (
          SELECT COUNT(*)::int AS pending_delivery_count
          FROM orders
          WHERE status IN ('out_for_delivery', 'packed', 'confirmed')
            AND scheduled_date = $1
        ),
        unassigned_stats AS (
          SELECT COUNT(*)::int AS unassigned_orders_count
          FROM orders
          WHERE scheduled_date = $1 
            AND (delivery_partner_id IS NULL OR delivery_partner_id = '')
            AND status IN ('pending', 'placed', 'confirmed', 'packed')
        ),
        leave_stats AS (
          SELECT COUNT(*)::int AS pending_leave_requests_count
          FROM delivery_leave_requests
          WHERE status = 'pending' AND deleted_at IS NULL
        ),
        outstandings_stats AS (
          SELECT 
            COALESCE(SUM(due_amount), 0)::numeric AS total_outstandings_amount,
            COUNT(*)::int AS pending_outstandings_count
          FROM customer_bills
          WHERE deleted_at IS NULL
            AND due_amount > 0
            AND LOWER(status::text) NOT IN ('paid', 'cancelled')
        )
        SELECT
          cs.*,
          ss.*,
          tod.*,
          rev.*,
          ds.*,
          ws.*,
          invs.*,
          pd.*,
          us.*,
          ls.*,
          os.*
        FROM customer_stats cs
        CROSS JOIN subscription_stats ss
        CROSS JOIN today_orders tod
        CROSS JOIN overall_revenue rev
        CROSS JOIN delivery_stats ds
        CROSS JOIN wallet_stats ws
        CROSS JOIN inventory_stats invs
        CROSS JOIN pending_deliveries pd
        CROSS JOIN unassigned_stats us
        CROSS JOIN leave_stats ls
        CROSS JOIN outstandings_stats os
      `;

      const runsSql = `
        SELECT
          dr.run_id,
          -- delivery_runs has no run_number column; run_id already holds the
          -- human-readable RUN-<date>-<slot>-<seq> value the UI shows.
          dr.run_id AS run_number,
          dr.delivery_partner_id,
          dr.branch_id,
          dr.run_date,
          dr.delivery_slot,
          dr.status,
          COALESCE(dr.total_addresses, 0)::int AS total_addresses,
          COALESCE(dr.completed_addresses, 0)::int AS completed_addresses,
          COALESCE(dr.failed_addresses, 0)::int AS failed_addresses,
          COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.user_name, 'Partner') AS partner_name,
          COALESCE(u.phone, '') AS partner_phone,
          COALESCE(b.branch_name, dr.branch_id) AS branch_name
        FROM delivery_runs dr
        LEFT JOIN users u ON u.user_id = dr.delivery_partner_id
        LEFT JOIN branches b ON b.branch_id = dr.branch_id
        WHERE dr.run_date = $1 AND dr.deleted_at IS NULL
        ORDER BY 
          CASE 
            WHEN dr.status = 'in_progress' THEN 1
            WHEN dr.status = 'assigned' THEN 2
            WHEN dr.status = 'completed' THEN 3
            ELSE 4
          END ASC,
          dr.created_at DESC
        LIMIT 10
      `;

      const runsSummarySql = `
        SELECT
          COUNT(*)::int AS total_runs,
          COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_runs,
          COUNT(*) FILTER (WHERE status = 'assigned')::int AS assigned_runs,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_runs
        FROM delivery_runs
        WHERE run_date = $1 AND deleted_at IS NULL
      `;

      const leaveRequestsSql = `
        SELECT
          dlr.id,
          dlr.delivery_partner_id,
          dlr.leave_date,
          dlr.end_date,
          dlr.leave_type,
          dlr.half_day_shift,
          dlr.reason,
          dlr.status,
          dlr.admin_remarks,
          dlr.created_at,
          COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.user_name, 'Partner') AS partner_name,
          COALESCE(u.phone, '') AS partner_phone,
          COALESCE(b.branch_name, dp.branch_id, 'Main Branch') AS branch_name
        FROM delivery_leave_requests dlr
        LEFT JOIN delivery_partners dp ON dp.delivery_partner_id = dlr.delivery_partner_id
        LEFT JOIN users u ON u.user_id = dlr.delivery_partner_id
        LEFT JOIN branches b ON b.branch_id = dp.branch_id
        WHERE dlr.deleted_at IS NULL
        ORDER BY 
          CASE WHEN dlr.status = 'pending' THEN 1 ELSE 2 END ASC,
          dlr.created_at DESC
        LIMIT 6
      `;

      const [rows, runsRows, runsSummaryRes, leaveRows] = await Promise.all([
        this.db.query(sql, [today]),
        this.db.query(runsSql, [today]),
        this.db.query(runsSummarySql, [today]),
        this.db.query(leaveRequestsSql),
      ]);

      const kpi = rows[0] ?? {};
      const runsSummary = runsSummaryRes[0] ?? {
        total_runs: 0,
        in_progress_runs: 0,
        assigned_runs: 0,
        completed_runs: 0,
      };

      // Generate heuristic operational insights
      const insights: Array<{
        id: string;
        type: 'success' | 'warning' | 'info' | 'critical';
        title: string;
        description: string;
        actionText?: string;
        actionHref?: string;
      }> = [];

      const unassigned = kpi.unassigned_orders_count ?? 0;
      if (unassigned > 0) {
        insights.push({
          id: 'unassigned_orders',
          type: 'warning',
          title: `${unassigned} Unassigned Orders for Today`,
          description: `Orders are confirmed and packed. Run the automatic route optimizer to assign delivery partners.`,
          actionText: 'Assign Now',
          actionHref: '/admin/delivery/assign',
        });
      } else if ((kpi.today_total ?? 0) > 0) {
        insights.push({
          id: 'all_assigned',
          type: 'success',
          title: `All Today's Orders Assigned`,
          description: `All ${kpi.today_total} orders are mapped to delivery partners and active runs.`,
          actionText: 'View Runs',
          actionHref: '/admin/delivery/assign',
        });
      }

      if (runsSummary.in_progress_runs > 0) {
        insights.push({
          id: 'active_runs',
          type: 'info',
          title: `${runsSummary.in_progress_runs} Delivery Runs Live on Road`,
          description: `Partners are actively executing route stops. Monitor real-time GPS locations and delivery drop proofs.`,
          actionText: 'Live Tracking',
          actionHref: '/admin/delivery-tracking',
        });
      }

      const pendingLeaves = kpi.pending_leave_requests_count ?? 0;
      if (pendingLeaves > 0) {
        insights.push({
          id: 'leave_requests_pending',
          type: 'warning',
          title: `${pendingLeaves} Unreviewed Partner Leave Request${pendingLeaves > 1 ? 's' : ''}`,
          description: `Delivery partners have submitted time-off requests. Review and approve to ensure smooth shift coverage.`,
          actionText: 'Review Leaves',
          actionHref: '/admin/delivery/leave-requests',
        });
      }

      const lowStock = kpi.low_stock_count ?? 0;
      const outOfStock = kpi.out_of_stock_count ?? 0;
      if (outOfStock > 0 || lowStock > 0) {
        insights.push({
          id: 'inventory_alert',
          type: outOfStock > 0 ? 'critical' : 'warning',
          title: `${outOfStock} Out of Stock & ${lowStock} Low Stock Variants`,
          description: `Restocking needed before next delivery cycle to avoid subscription fulfillment failures.`,
          actionText: 'View Inventory',
          actionHref: '/admin/inventory/overview',
        });
      }

      const activeSubs = kpi.active_subscriptions ?? 0;
      if (activeSubs > 0) {
        insights.push({
          id: 'subscription_health',
          type: 'success',
          title: `${activeSubs} Active Subscriptions`,
          description: `Recurring daily & alternate day milk subscriptions driving ${kpi.today_subscription_orders ?? 0} deliveries today.`,
          actionText: 'Manage Subscriptions',
          actionHref: '/admin/subscriptions/status',
        });
      }

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
          today_assigned: kpi.today_assigned ?? 0,
          today_packed: kpi.today_packed ?? 0,
          today_out_for_delivery: kpi.today_out_for_delivery ?? 0,
          today_delivered: kpi.today_delivered ?? 0,
          today_cancelled: kpi.today_cancelled ?? 0,
          today_revenue: Number(kpi.today_revenue ?? 0),
          today_subscription_orders: kpi.today_subscription_orders ?? 0,
          today_onetime_orders: kpi.today_onetime_orders ?? 0,
          today_unassigned_orders: unassigned,

          // Revenue
          total_revenue: Number(kpi.total_revenue ?? 0),
          revenue_30d: Number(kpi.revenue_30d ?? 0),
          revenue_7d: Number(kpi.revenue_7d ?? 0),

          // Delivery
          total_delivery_partners: kpi.total_delivery_partners ?? 0,
          active_delivery_partners: kpi.active_delivery_partners ?? 0,
          pending_delivery_count: kpi.pending_delivery_count ?? 0,
          today_runs_summary: runsSummary,
          today_recent_runs: runsRows || [],

          // Wallet
          total_wallet_balance: Number(kpi.total_wallet_balance ?? 0),
          wallets_with_balance: kpi.wallets_with_balance ?? 0,

          // Inventory
          total_variants: kpi.total_variants ?? 0,
          low_stock_count: kpi.low_stock_count ?? 0,
          out_of_stock_count: kpi.out_of_stock_count ?? 0,

          // Leave & Operations
          pending_leave_requests_count: kpi.pending_leave_requests_count ?? 0,
          unreviewed_leave_requests_count: kpi.pending_leave_requests_count ?? 0,
          today_recent_leave_requests: leaveRows || [],
          total_outstandings_amount: Number(kpi.total_outstandings_amount ?? 0),
          pending_outstandings_count: kpi.pending_outstandings_count ?? 0,

          // Insights
          insights,

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
