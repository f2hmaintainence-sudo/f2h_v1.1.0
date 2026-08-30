// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : refund-eligibility.service.ts
// Description : Works out which prepaid subscription days/orders are refundable
//               and materialises them as subscription_refund_candidates.
//
//               Money is always valued at subscription_items.final_price — the
//               price the customer actually prepaid, already net of discounts
//               and coupons. product_variants.price is never consulted, because
//               the catalogue price today says nothing about what was paid.
//
//               Two sources of refundability:
//                 • pause  — a day inside a pause window that was never delivered
//                 • failed — a subscription order whose delivery explicitly failed
//
//               Generation is idempotent: every candidate is upserted against
//               uq_refund_candidate (subscription_item_id, scheduled_date,
//               delivery_slot), so re-scanning a month can never double-count.
// ============================================================================

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../../shared/database/Database.service';
import {
  RefundCandidatesRepository,
  CreateCandidateInput,
} from './refund-candidates.repository';

export interface ScanFilters {
  /** YYYY-MM — expanded to the whole calendar month. */
  month?: string;
  from?: string;
  to?: string;
  branch_id?: string;
  customer_id?: string;
  subscription_id?: string;
}

export interface EligibleRow {
  subscription_id: string;
  subscription_item_id: string;
  customer_id: string;
  order_id: string | null;
  scheduled_date: string;
  slot: 'morning' | 'evening';
  quantity: number;
  unit_price: number;
  final_price: number;
  refund_amount: number;
  product_name: string | null;
  variant_name: string | null;
  source: 'pause' | 'order';
  refund_reason: 'pause' | 'failed';
  note: string | null;
}

export interface ScanResult {
  range: { from: string; to: string };
  found: number;
  created: number;
  skipped_existing: number;
  pause_days: number;
  failed_orders: number;
  total_amount: number;
}

@Injectable()
export class RefundEligibilityService {
  private readonly logger = new Logger(RefundEligibilityService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly repo: RefundCandidatesRepository,
  ) {}

  // ── Range helpers ─────────────────────────────────────────────────────────

  /** Resolves month / from / to into a concrete window. Defaults to this month. */
  resolveRange(filters: ScanFilters): { from: string; to: string } {
    const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

    if (isDate(filters.from) && isDate(filters.to)) {
      return filters.from! <= filters.to!
        ? { from: filters.from!, to: filters.to! }
        : { from: filters.to!, to: filters.from! };
    }

    const month =
      filters.month && /^\d{4}-\d{2}$/.test(filters.month)
        ? filters.month
        : new Date().toISOString().slice(0, 7);

    const [y, m] = month.split('-').map(Number);
    const from = `${month}-01`;
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // last day
    return { from, to };
  }

  // ── Eligibility queries ───────────────────────────────────────────────────

  /**
   * Days inside a pause window that were prepaid and never delivered.
   *
   * A resumed pause keeps its original end_date, so the window is clipped to the
   * day before the resume — otherwise days the customer actually received would
   * look refundable. The window is also clipped to today: a future paused day
   * has not been missed yet.
   */
  private async findPausedDays(
    range: { from: string; to: string },
    filters: ScanFilters,
  ): Promise<EligibleRow[]> {
    const params: any[] = [range.from, range.to];
    const scope: string[] = [];

    if (filters.branch_id) {
      params.push(filters.branch_id);
      scope.push(`AND s.branch_id = $${params.length}`);
    }
    if (filters.customer_id) {
      params.push(filters.customer_id);
      scope.push(`AND s.customer_id = $${params.length}`);
    }
    if (filters.subscription_id) {
      params.push(filters.subscription_id);
      scope.push(`AND s.subscription_id = $${params.length}`);
    }

    const rows = await this.db.query<any>(
      `
      WITH pause_windows AS (
        SELECT
          sp.id AS pause_id,
          sp.subscription_id,
          GREATEST(sp.start_date, $1::date) AS win_from,
          LEAST(
            CASE WHEN sp.status = 'resumed'
                 THEN LEAST(sp.end_date, (sp.updated_at AT TIME ZONE 'Asia/Kolkata')::date - 1)
                 ELSE sp.end_date END,
            $2::date,
            CURRENT_DATE
          ) AS win_to
        FROM subscription_pauses sp
        JOIN subscriptions s ON s.subscription_id = sp.subscription_id
        WHERE sp.deleted_at IS NULL
          AND s.deleted_at IS NULL
          AND s.payment_type = 'prepaid'
          ${scope.join('\n          ')}
      ),
      paused_days AS (
        SELECT pw.pause_id, pw.subscription_id, d::date AS scheduled_date
        FROM pause_windows pw
        CROSS JOIN LATERAL generate_series(pw.win_from, pw.win_to, '1 day') AS d
        WHERE pw.win_from <= pw.win_to
      ),
      items AS (
        SELECT pd.*, si.subscription_item_id,
               COALESCE(si.final_price, si.unit_price - COALESCE(si.discount_amount, 0) - COALESCE(si.coupon_amount, 0), si.unit_price) AS final_price,
               si.unit_price,
               s.customer_id, pv.name AS variant_name, p.name AS product_name
        FROM paused_days pd
        JOIN subscriptions s ON s.subscription_id = pd.subscription_id
        JOIN subscription_items si
          ON si.subscription_id = pd.subscription_id
         AND si.deleted_at IS NULL
        LEFT JOIN product_variants pv ON pv.variant_id = si.product_variant_id
        LEFT JOIN products p ON p.product_id = pv.product_id
      ),
      qty AS (
        SELECT i.*,
          COALESCE(cs.m_quantity, ws.m_quantity, 0)::numeric AS m_qty,
          COALESCE(cs.e_quantity, ws.e_quantity, 0)::numeric AS e_qty
        FROM items i
        LEFT JOIN subscription_custom_schedule cs
          ON cs.subscription_item_id = i.subscription_item_id
         AND cs.delivery_date = i.scheduled_date
         AND cs.deleted_at IS NULL
        LEFT JOIN subscription_weekly_schedule ws
          ON ws.subscription_item_id = i.subscription_item_id
         AND ws.day_of_week = EXTRACT(DOW FROM i.scheduled_date)::int
         AND ws.deleted_at IS NULL
         AND COALESCE(ws.effective_from, i.scheduled_date) <= i.scheduled_date
         AND COALESCE(ws.effective_to, i.scheduled_date) >= i.scheduled_date
      )
      SELECT subscription_id, subscription_item_id, customer_id,
             scheduled_date::text AS scheduled_date, slot,
             quantity::numeric AS quantity,
             unit_price::numeric AS unit_price,
             final_price::numeric AS final_price,
             ROUND(quantity * COALESCE(final_price, unit_price, 0), 2) AS refund_amount,
             product_name, variant_name, pause_id
      FROM (
        SELECT q.*, 'morning' AS slot, q.m_qty AS quantity FROM qty q WHERE q.m_qty > 0
        UNION ALL
        SELECT q.*, 'evening' AS slot, q.e_qty AS quantity FROM qty q WHERE q.e_qty > 0
      ) x
      WHERE NOT EXISTS (
        SELECT 1 FROM orders o
        WHERE o.subscription_id = x.subscription_id
          AND o.scheduled_date = x.scheduled_date
          AND o.delivery_slot = x.slot
          AND o.status = 'delivered'
          AND o.deleted_at IS NULL
      )
      ORDER BY scheduled_date, subscription_item_id, slot
      `,
      params,
    );

    return (rows ?? []).map((r: any) => ({
      subscription_id: r.subscription_id,
      subscription_item_id: r.subscription_item_id,
      customer_id: r.customer_id,
      order_id: null,
      scheduled_date: r.scheduled_date,
      slot: r.slot,
      quantity: Number(r.quantity),
      unit_price: Number(r.unit_price ?? 0),
      final_price: Number(r.final_price ?? 0),
      refund_amount: Number(r.refund_amount ?? 0),
      product_name: r.product_name ?? null,
      variant_name: r.variant_name ?? null,
      source: 'pause',
      refund_reason: 'pause',
      note: `Paused day (pause #${r.pause_id})`,
    }));
  }

  /**
   * Finds orders on prepaid subscriptions that were scheduled within the window
   * but never delivered (marked failed on a run, logged with a delivery issue,
   * or still pending past their delivery date without a delivered status).
   */
  private async findFailedOrders(
    range: { from: string; to: string },
    filters: ScanFilters,
  ): Promise<EligibleRow[]> {
    const params: any[] = [range.from, range.to];
    const scope: string[] = [];

    if (filters.branch_id) {
      params.push(filters.branch_id);
      scope.push(`AND o.branch_id = $${params.length}`);
    }
    if (filters.customer_id) {
      params.push(filters.customer_id);
      scope.push(`AND o.customer_id = $${params.length}`);
    }
    if (filters.subscription_id) {
      params.push(filters.subscription_id);
      scope.push(`AND o.subscription_id = $${params.length}`);
    }

    const rows = await this.db.query<any>(
      `
      SELECT
        o.subscription_id,
        oi.subscription_item_id,
        o.customer_id,
        o.order_id,
        o.scheduled_date::text AS scheduled_date,
        o.delivery_slot AS slot,
        oi.quantity::numeric AS quantity,
        si.unit_price::numeric AS unit_price,
        COALESCE(si.final_price, si.unit_price - COALESCE(si.discount_amount, 0) - COALESCE(si.coupon_amount, 0), si.unit_price)::numeric AS final_price,
        ROUND(oi.quantity * COALESCE(si.final_price, si.unit_price - COALESCE(si.discount_amount, 0) - COALESCE(si.coupon_amount, 0), si.unit_price), 2) AS refund_amount,
        p.name AS product_name,
        pv.name AS variant_name,
        oi.item_status::text AS item_status,
        dra.failed_reason
      FROM orders o
      JOIN order_items oi
        ON oi.order_id = o.order_id
       AND oi.deleted_at IS NULL
       AND oi.subscription_item_id IS NOT NULL
      JOIN subscriptions s
        ON s.subscription_id = o.subscription_id
       AND s.payment_type = 'prepaid'
       AND s.deleted_at IS NULL
      JOIN subscription_items si
        ON si.subscription_item_id = oi.subscription_item_id
       AND si.deleted_at IS NULL
      LEFT JOIN product_variants pv ON pv.variant_id = si.product_variant_id
      LEFT JOIN products p ON p.product_id = pv.product_id
      LEFT JOIN delivery_run_addresses dra
        ON (dra.order_ids::text LIKE '%' || o.order_id || '%') AND dra.deleted_at IS NULL
      WHERE o.deleted_at IS NULL
        AND o.scheduled_date BETWEEN $1::date AND $2::date
        AND o.status <> 'cancelled'
        AND o.status <> 'delivered'
        AND COALESCE(oi.item_status::text, '') NOT IN ('cancelled', 'returned')
        AND LOWER(COALESCE(oi.item_status::text, '')) <> 'delivered'
        ${scope.join('\n        ')}
        AND (
          dra.delivery_status = 'failed'
          OR EXISTS (
            SELECT 1 FROM delivery_proof_logs dpl
            WHERE dpl.subscription_id = o.subscription_id
              AND dpl.delivery_date = o.scheduled_date
              AND dpl.shift_type = o.delivery_slot
              AND dpl.delivery_status IN ('not_home', 'issue')
          )
        )
      ORDER BY o.scheduled_date, oi.subscription_item_id
      `,
      params,
    );

    return (rows ?? []).map((r: any) => {
      // A partially delivered line has no per-item delivered quantity anywhere in
      // the schema, so it is raised at full quantity and flagged for the admin to
      // confirm during review rather than silently over-refunded.
      const partial = String(r.item_status ?? '').toLowerCase() === 'partial';
      const reason = r.failed_reason ? `Failed delivery: ${r.failed_reason}` : 'Failed delivery';
      return {
        subscription_id: r.subscription_id,
        subscription_item_id: r.subscription_item_id,
        customer_id: r.customer_id,
        order_id: r.order_id,
        scheduled_date: r.scheduled_date,
        slot: (r.slot ?? 'morning') as 'morning' | 'evening',
        quantity: Number(r.quantity),
        unit_price: Number(r.unit_price ?? 0),
        final_price: Number(r.final_price ?? 0),
        refund_amount: Number(r.refund_amount ?? 0),
        product_name: r.product_name ?? null,
        variant_name: r.variant_name ?? null,
        source: 'order',
        refund_reason: 'failed',
        note: partial
          ? `${reason} — line marked partial, confirm delivered quantity before approving`
          : reason,
      };
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Everything refundable in the window, without writing anything. */
  async preview(filters: ScanFilters): Promise<{ range: { from: string; to: string }; rows: EligibleRow[] }> {
    const range = this.resolveRange(filters);
    const [paused, failed] = await Promise.all([
      this.findPausedDays(range, filters),
      this.findFailedOrders(range, filters),
    ]);

    // A failed order for a day already covered by a pause is the same money; the
    // unique key would collapse them anyway, so prefer the order row (it carries
    // the order reference) and drop the duplicate pause day.
    const orderKeys = new Set(
      failed.map((r) => `${r.subscription_item_id}|${r.scheduled_date}|${r.slot}`),
    );
    const deduped = [
      ...failed,
      ...paused.filter(
        (r) => !orderKeys.has(`${r.subscription_item_id}|${r.scheduled_date}|${r.slot}`),
      ),
    ];

    return { range, rows: deduped };
  }

  /** Materialises the refundable rows as candidates. Safe to re-run. */
  async scan(filters: ScanFilters): Promise<ScanResult> {
    const { range, rows } = await this.preview(filters);

    let created = 0;
    for (const row of rows) {
      const input: CreateCandidateInput = {
        subscription_id: row.subscription_id,
        subscription_item_id: row.subscription_item_id,
        customer_id: row.customer_id,
        order_id: row.order_id,
        scheduled_date: row.scheduled_date,
        delivery_slot: row.slot,
        quantity: row.quantity,
        unit_price: row.unit_price,
        final_price: row.final_price,
        refund_amount: row.refund_amount,
        refund_reason: row.refund_reason,
        source: row.source,
        notes: row.note,
      };
      const id = await this.repo.createCandidate(input);
      if (id) created++;
    }

    const result: ScanResult = {
      range,
      found: rows.length,
      created,
      skipped_existing: rows.length - created,
      pause_days: rows.filter((r) => r.source === 'pause').length,
      failed_orders: rows.filter((r) => r.source === 'order').length,
      total_amount:
        Math.round(rows.reduce((sum, r) => sum + r.refund_amount, 0) * 100) / 100,
    };

    this.logger.log(
      `Refund scan ${range.from}..${range.to}: ${result.found} eligible, ${created} new`,
    );
    return result;
  }

  // ── Event hooks ───────────────────────────────────────────────────────────

  /**
   * Called after a pause is recorded. Never throws — a refund candidate failing
   * to materialise must not roll back the pause the customer just requested.
   */
  async onPauseCreated(subscriptionId: string, from: string, to: string): Promise<number> {
    try {
      const result = await this.scan({ subscription_id: subscriptionId, from, to });
      return result.created;
    } catch (err) {
      this.logger.error('onPauseCreated failed', { err, subscriptionId, from, to });
      return 0;
    }
  }

  /** Called when a delivery stop is marked failed. Never throws. */
  async onDeliveryFailed(orderId: string): Promise<number> {
    try {
      const rows = await this.db.query<any>(
        `SELECT subscription_id, scheduled_date::text AS scheduled_date
           FROM orders
          WHERE order_id = $1 AND deleted_at IS NULL AND subscription_id IS NOT NULL
          LIMIT 1`,
        [orderId],
      );
      const order = rows?.[0];
      if (!order) return 0;

      const result = await this.scan({
        subscription_id: order.subscription_id,
        from: order.scheduled_date,
        to: order.scheduled_date,
      });
      return result.created;
    } catch (err) {
      this.logger.error('onDeliveryFailed failed', { err, orderId });
      return 0;
    }
  }
}
