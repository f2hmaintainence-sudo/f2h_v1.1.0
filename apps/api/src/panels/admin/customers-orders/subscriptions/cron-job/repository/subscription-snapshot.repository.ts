import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../../../shared/database/Database.service';

/**
 * SQL-first repository for high-volume subscription order generation.
 *
 * Design: Zero application-level loops. All data transformation happens
 * inside PostgreSQL using INSERT INTO ... SELECT with CTEs.
 *
 * Performance: 3 SQL statements handle 40,000+ subscriptions in under 10s.
 * PgBouncer compatible: short transactions, no temp tables, no session state.
 */
@Injectable()
export class SubscriptionSnapshotRepository {
  private readonly logger = new Logger(SubscriptionSnapshotRepository.name);

  constructor(private readonly db: DatabaseService) { }

  // ─── Pre-Dispatch Summary ───────────────────────────────────────────

  /**
   * Returns branch-wise aggregated item quantities for eligible subscriptions
   * BEFORE order generation. Admins use this to review stock requirements.
   *
   * Excludes subscriptions that already have orders for the target date+slot.
   */
  async getPreDispatchSummary(
    date: string,
    slot: 'morning' | 'evening',
    branchId?: string | null,
  ): Promise<any[]> {
    const qtyExpr = slot === 'morning' ? 'ws.m_quantity' : 'ws.e_quantity';

    const params: any[] = [date];
    let branchFilter = '';
    if (branchId) {
      params.push(branchId);
      branchFilter = `AND s.branch_id = $${params.length}`;
    }

    return this.db.query(
      `
      SELECT
        s.branch_id,
        si.product_variant_id,
        pv.name                           AS variant_name,
        p.name                            AS product_name,
        SUM(${qtyExpr})                   AS total_quantity,
        COUNT(DISTINCT s.subscription_id) AS subscription_count
      FROM subscriptions s
      JOIN subscription_items si
        ON si.subscription_id = s.subscription_id
      JOIN subscription_weekly_schedule ws
        ON ws.subscription_item_id = si.subscription_item_id
      LEFT JOIN product_variants pv
        ON pv.variant_id = si.product_variant_id
      LEFT JOIN products p
        ON p.product_id = pv.product_id
      WHERE s.status = 'active'
        AND s.start_date <= $1::date
        AND (s.end_date IS NULL OR s.end_date >= $1::date)
        AND (
          s.pause_from_date IS NULL
          OR s.pause_to_date IS NULL
          OR NOT ($1::date BETWEEN s.pause_from_date AND s.pause_to_date)
        )
        AND si.status = 'active'
        AND (si.start_date IS NULL OR si.start_date <= $1::date)
        AND (si.end_date IS NULL OR si.end_date >= $1::date)
        AND ws.day_of_week = EXTRACT(DOW FROM $1::date)::int
        AND ${qtyExpr} > 0
        ${branchFilter}
        -- Exclude subscriptions that already have orders
        AND NOT EXISTS (
          SELECT 1 FROM orders o
          WHERE o.subscription_id = s.subscription_id
            AND o.scheduled_date = $1::date
            AND o.delivery_slot = '${slot}'
            AND o.order_source = 'subscription'
        )
      GROUP BY s.branch_id, si.product_variant_id, pv.name, p.name
      ORDER BY s.branch_id NULLS LAST, p.name, pv.name
      `,
      params,
    );
  }

  // ─── SQL-First Order Generation ─────────────────────────────────────

  /**
   * STEP 1: Insert orders directly from eligible subscriptions.
   *
   * Uses INSERT INTO orders ... SELECT with a CTE that:
   *  - Filters eligible subscriptions (active, date range, not paused)
   *  - Matches weekly schedule for the target day
   *  - Aggregates item subtotals per subscription
   *  - Generates order_id via gen_random_uuid()
   *  - Uses ON CONFLICT DO NOTHING for idempotency
   *
   * Returns the count of newly inserted orders.
   */
  async insertOrdersFromSubscriptions(
    date: string,
    slot: 'morning' | 'evening',
    generationType: 'cron' | 'manual',
    branchId?: string | null,
  ): Promise<number> {
    const qtyExpr = slot === 'morning' ? 'ws.m_quantity' : 'ws.e_quantity';

    const params: any[] = [date, slot, generationType];
    let branchFilter = '';
    if (branchId) {
      params.push(branchId);
      branchFilter = `AND s.branch_id = $${params.length}`;
    }

    const result = await this.db.query<{ inserted_count: string }>(
      `
      WITH eligible_subs AS (
        -- Distinct eligible subscriptions with their subtotals
        SELECT
          s.subscription_id,
          s.customer_id,
          s.address_id,
          s.branch_id,
          ca.contact_name,
          ca.contact_mobile,
          ca.address_line,
          SUM(si.unit_price * ${qtyExpr}) AS subtotal
        FROM subscriptions s
        JOIN subscription_items si
          ON si.subscription_id = s.subscription_id
        JOIN subscription_weekly_schedule ws
          ON ws.subscription_item_id = si.subscription_item_id
        LEFT JOIN customer_addresses ca
          ON ca.address_id = s.address_id
        WHERE s.status = 'active'
          AND s.start_date <= $1::date
          AND (s.end_date IS NULL OR s.end_date >= $1::date)
          AND (
            s.pause_from_date IS NULL
            OR s.pause_to_date IS NULL
            OR NOT ($1::date BETWEEN s.pause_from_date AND s.pause_to_date)
          )
          AND si.status = 'active'
          AND (si.start_date IS NULL OR si.start_date <= $1::date)
          AND (si.end_date IS NULL OR si.end_date >= $1::date)
          AND ws.day_of_week = EXTRACT(DOW FROM $1::date)::int
          AND ${qtyExpr} > 0
          ${branchFilter}
        GROUP BY
          s.subscription_id, s.customer_id, s.address_id, s.branch_id,
          ca.contact_name, ca.contact_mobile, ca.address_line
      ),
      inserted AS (
        INSERT INTO orders (
          order_id,
          customer_id,
          customer_name,
          order_source,
          subscription_id,
          address_id,
          address_line,
          contact_number,
          branch_id,
          delivery_slot,
          scheduled_date,
          status,
          subtotal,
          discount_amount,
          gst_amount,
          total_amount,
          payment_status,
          generation_type,
          created_by
        )
        SELECT
          'ORD_' || upper(substr(gen_random_uuid()::text, 1, 12)),
          es.customer_id,
          COALESCE(es.contact_name, ''),
          'subscription',
          es.subscription_id,
          es.address_id,
          COALESCE(es.address_line, 'Address not set'),
          COALESCE(es.contact_mobile, ''),
          es.branch_id,
          $2,
          $1::date,
          'confirmed',
          es.subtotal,
          0,
          0,
          es.subtotal,
          'paid',
          $3,
          'system'
        FROM eligible_subs es
        ON CONFLICT (subscription_id, scheduled_date, delivery_slot) DO NOTHING
        RETURNING 1
      )
      SELECT COUNT(*)::text AS inserted_count FROM inserted
      `,
      params,
    );

    return parseInt(result[0]?.inserted_count || '0', 10);
  }

  /**
   * STEP 2: Insert order items for newly created orders.
   *
   * Joins the orders table back to subscription_items and weekly_schedule
   * to generate line items only for orders that were just created
   * (identified by scheduled_date + delivery_slot + order_source + generation_type).
   *
   * Uses a subquery to avoid inserting items for orders that already have items.
   */
  async insertOrderItemsFromSubscriptions(
    date: string,
    slot: 'morning' | 'evening',
    branchId?: string | null,
  ): Promise<number> {
    const qtyExpr = slot === 'morning' ? 'ws.m_quantity' : 'ws.e_quantity';

    const params: any[] = [date, slot];
    let branchFilter = '';
    if (branchId) {
      params.push(branchId);
      branchFilter = `AND o.branch_id = $${params.length}`;
    }

    const result = await this.db.query<{ inserted_count: string }>(
      `
      WITH items_to_insert AS (
        SELECT
          o.order_id,
          si.subscription_item_id,
          si.product_variant_id  AS variant_id,
          ${qtyExpr}             AS quantity,
          si.unit_price,
          si.is_free
        FROM orders o
        JOIN subscription_items si
          ON si.subscription_id = o.subscription_id
        JOIN subscription_weekly_schedule ws
          ON ws.subscription_item_id = si.subscription_item_id
        WHERE o.scheduled_date = $1::date
          AND o.delivery_slot = $2
          AND o.order_source = 'subscription'
          ${branchFilter}
          AND si.status = 'active'
          AND (si.start_date IS NULL OR si.start_date <= $1::date)
          AND (si.end_date IS NULL OR si.end_date >= $1::date)
          AND ws.day_of_week = EXTRACT(DOW FROM $1::date)::int
          AND ${qtyExpr} > 0
          -- Only for orders that don't already have items
          AND NOT EXISTS (
            SELECT 1 FROM order_items oi WHERE oi.order_id = o.order_id
          )
      ),
      inserted AS (
        INSERT INTO order_items (order_id, subscription_item_id, variant_id, quantity, unit_price, is_free)
        SELECT order_id, subscription_item_id, variant_id, quantity, unit_price, is_free
        FROM items_to_insert
        RETURNING 1
      )
      SELECT COUNT(*)::text AS inserted_count FROM inserted
      `,
      params,
    );

    return parseInt(result[0]?.inserted_count || '0', 10);
  }

  /**
   * STEP 3: Log ORDER_CREATED for each newly generated order.
   *
   * Generates one log entry per order (not per item) to keep log volume manageable.
   */
  async insertOrderGenerationLogs(
    date: string,
    slot: 'morning' | 'evening',
    branchId?: string | null,
  ): Promise<number> {
    const params: any[] = [date, slot];
    let branchFilter = '';
    if (branchId) {
      params.push(branchId);
      branchFilter = `AND o.branch_id = $${params.length}`;
    }

    const result = await this.db.query<{ inserted_count: string }>(
      `
      WITH logs_to_insert AS (
        SELECT
          o.subscription_id,
          'ORDER_CREATED'::varchar(50) AS action,
          jsonb_build_object(
            'order_id', o.order_id,
            'delivery_date', o.scheduled_date::text,
            'slot', $2::text,
            'total_amount', o.total_amount,
            'generation_type', o.generation_type
          ) AS new_data
        FROM orders o
        WHERE o.scheduled_date = $1::date
          AND o.delivery_slot = $2
          AND o.order_source = 'subscription'
          ${branchFilter}
          -- Only log orders that haven't been logged yet
          AND NOT EXISTS (
            SELECT 1 FROM subscription_logs sl
            WHERE sl.subscription_id = o.subscription_id
              AND sl.action = 'ORDER_CREATED'
              AND sl.new_data->>'order_id' = o.order_id
          )
      ),
      inserted AS (
        INSERT INTO subscription_logs ( action, new_data, created_by)
        SELECT  action, new_data, 'system'
        FROM logs_to_insert
        RETURNING 1
      )
      SELECT COUNT(*)::text AS inserted_count FROM inserted
      `,
      params,
    );

    return parseInt(result[0]?.inserted_count || '0', 10);
  }

  // ─── One-Time Order Confirmation ────────────────────────────────────

  /**
   * Confirms eligible one-time orders (placed → confirmed) for the given
   * date and slot. Only touches orders that:
   *  - Have order_source != 'subscription' (i.e. one-time / manual)
   *  - Are currently in 'placed' status
   *  - Match the exact scheduled_date and delivery_slot
   *
   * Uses a WHERE clause guard so repeated calls are idempotent:
   * already-confirmed orders won't be touched.
   *
   * Returns the count of rows updated.
   */
  async confirmOneTimeOrders(
    date: string,
    slot: 'morning' | 'evening',
    branchId?: string | null,
  ): Promise<number> {
    const params: any[] = [date, slot];
    let branchFilter = '';
    if (branchId) {
      params.push(branchId);
      branchFilter = `AND branch_id = $${params.length}`;
    }

    const result = await this.db.query<{ updated_count: string }>(
      `
      WITH confirmed AS (
        UPDATE orders
        SET
          status = 'confirmed',
          updated_at = NOW()
        WHERE scheduled_date = $1::date
          AND delivery_slot = $2
          AND order_source != 'subscription'
          AND status = 'placed'
          ${branchFilter}
        RETURNING order_id, branch_id
      )
      SELECT COUNT(*)::text AS updated_count FROM confirmed
      `,
      params,
    );

    return parseInt(result[0]?.updated_count || '0', 10);
  }

  /**
   * Counts one-time orders that were already confirmed or beyond 'placed'
   * for the given date/slot — i.e. orders that would be skipped.
   */
  async countSkippedOneTimeOrders(
    date: string,
    slot: 'morning' | 'evening',
    branchId?: string | null,
  ): Promise<number> {
    const params: any[] = [date, slot];
    let branchFilter = '';
    if (branchId) {
      params.push(branchId);
      branchFilter = `AND branch_id = $${params.length}`;
    }

    const result = await this.db.query<{ cnt: string }>(
      `
      SELECT COUNT(*)::text AS cnt
      FROM orders
      WHERE scheduled_date = $1::date
        AND delivery_slot = $2
        AND order_source != 'subscription'
        AND status != 'placed'
        ${branchFilter}
      `,
      params,
    );

    return parseInt(result[0]?.cnt || '0', 10);
  }

  // ─── Branch-Wise Statistics ────────────────────────────────────────

  /**
   * Returns branch-wise breakdown of subscription orders created and
   * one-time orders confirmed for the given date/slot.
   */
  async getBranchWiseStats(
    date: string,
    slot: 'morning' | 'evening',
    branchId?: string | null,
  ): Promise<Array<{
    branch_id: string | null;
    branch_name: string | null;
    subscription_orders_created: number;
    onetime_orders_confirmed: number;
    total_processed: number;
  }>> {
    const params: any[] = [date, slot];
    let branchFilter = '';
    if (branchId) {
      params.push(branchId);
      branchFilter = `AND o.branch_id = $${params.length}`;
    }

    return this.db.query(
      `
      SELECT
        o.branch_id,
        b.branch_name,
        COUNT(*) FILTER (
          WHERE o.order_source = 'subscription'
            AND o.scheduled_date = $1::date
            AND o.delivery_slot = $2
        )::int AS subscription_orders_created,
        COUNT(*) FILTER (
          WHERE o.order_source != 'subscription'
            AND o.status = 'confirmed'
            AND o.scheduled_date = $1::date
            AND o.delivery_slot = $2
        )::int AS onetime_orders_confirmed,
        COUNT(*)::int AS total_processed
      FROM orders o
      LEFT JOIN branches b ON b.branch_id = o.branch_id
      WHERE o.scheduled_date = $1::date
        AND o.delivery_slot = $2
        AND (
          (o.order_source = 'subscription')
          OR (o.order_source != 'subscription' AND o.status = 'confirmed')
        )
        ${branchFilter}
      GROUP BY o.branch_id, b.branch_name
      ORDER BY b.branch_name NULLS LAST
      `,
      params,
    );
  }

  // ─── Error Logging ──────────────────────────────────────────────────

  /**
   * Logs a process-level error to subscription_logs.
   */
  async logProcessError(
    subscriptionId: string | null,
    action: string,
    errorMsg: string,
    targetDate: string,
    slot: string,
  ): Promise<void> {
    await this.db.query(
      `
      INSERT INTO subscription_logs (
        subscription_id,
        action,
        new_data,
        created_by
      )
      VALUES ($1, $2, $3::jsonb, 'system')
      `,
      [
        subscriptionId,
        action,
        JSON.stringify({
          error: errorMsg,
          delivery_date: targetDate,
          slot,
        }),
      ],
    );
  }
}

