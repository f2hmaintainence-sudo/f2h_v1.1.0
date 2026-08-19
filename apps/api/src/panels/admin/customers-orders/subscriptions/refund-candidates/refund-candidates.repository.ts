import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../../shared/database/Database.service';

export type RefundReason = 'pause' | 'failed' | 'cancelled' | 'skipped' | 'stock_out';
export type RefundSource = 'order' | 'pause';
export type CandidateStatus = 'pending' | 'approved' | 'refunded' | 'rejected';

export interface CreateCandidateInput {
  subscription_id: string;
  subscription_item_id: string;
  customer_id: string;
  order_id?: string | null;
  scheduled_date: string;        // YYYY-MM-DD
  delivery_slot: 'morning' | 'evening';
  quantity: number;
  unit_price: number;
  final_price: number;
  refund_amount: number;         // quantity × final_price
  refund_reason: RefundReason;
  source: RefundSource;
  notes?: string | null;
}

@Injectable()
export class RefundCandidatesRepository {
  private readonly logger = new Logger(RefundCandidatesRepository.name);

  constructor(private readonly db: DatabaseService) {}

  // ─── Create / Upsert ────────────────────────────────────────────────────────

  /**
   * Idempotent insert. If a candidate already exists for the same
   * (subscription_item_id, scheduled_date, delivery_slot), it is a no-op.
   * Returns the candidate_id of the inserted (or existing) row.
   */
  async createCandidate(input: CreateCandidateInput): Promise<string | null> {
    const rows = await this.db.query(
      `INSERT INTO subscription_refund_candidates (
         subscription_id, subscription_item_id, customer_id, order_id,
         scheduled_date, delivery_slot, quantity, unit_price, final_price,
         refund_amount, refund_reason, source, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (subscription_item_id, scheduled_date, delivery_slot) DO NOTHING
       RETURNING refund_candidate_id`,
      [
        input.subscription_id,
        input.subscription_item_id,
        input.customer_id,
        input.order_id ?? null,
        input.scheduled_date,
        input.delivery_slot,
        input.quantity,
        input.unit_price,
        input.final_price,
        input.refund_amount,
        input.refund_reason,
        input.source,
        input.notes ?? null,
      ],
    );
    return rows?.[0]?.refund_candidate_id ?? null;
  }

  // ─── Summary Stats ───────────────────────────────────────────────────────────

  async getSummary(): Promise<any> {
    const rows = await this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='pending')::int               AS pending_count,
         COUNT(*) FILTER (WHERE status='refunded')::int              AS refunded_count,
         COUNT(*) FILTER (WHERE status='rejected')::int              AS rejected_count,
         COALESCE(SUM(refund_amount) FILTER (WHERE status='pending'),0)::numeric  AS pending_amount,
         COALESCE(SUM(refund_amount) FILTER (WHERE status='refunded'),0)::numeric AS refunded_amount,
         COUNT(DISTINCT customer_id) FILTER (WHERE status='pending')::int AS pending_customers
       FROM subscription_refund_candidates
       WHERE deleted_at IS NULL`,
      [],
    );
    return rows[0] ?? {};
  }

  // ─── Table (paginated) ───────────────────────────────────────────────────────

  async getTable(query: any): Promise<{ rows: any[]; total: number }> {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = ["src.deleted_at IS NULL"];
    const params: any[] = [];

    if (query.customer_id) {
      params.push(query.customer_id);
      conditions.push(`src.customer_id = $${params.length}`);
    }
    if (query.subscription_id) {
      params.push(query.subscription_id);
      conditions.push(
        `(src.subscription_id = $${params.length} OR s.subscription_number = $${params.length})`,
      );
    }
    if (query.status) {
      params.push(query.status);
      conditions.push(`src.status = $${params.length}`);
    }
    if (query.refund_reason) {
      params.push(query.refund_reason);
      conditions.push(`src.refund_reason = $${params.length}`);
    }
    if (query.date_from) {
      params.push(query.date_from);
      conditions.push(`src.scheduled_date >= $${params.length}`);
    }
    if (query.date_to) {
      params.push(query.date_to);
      conditions.push(`src.scheduled_date <= $${params.length}`);
    }
    if (query.month) {
      // month = YYYY-MM
      params.push(query.month + '-01');
      params.push(query.month + '-31');
      conditions.push(`src.scheduled_date BETWEEN $${params.length - 1} AND $${params.length}`);
    }
    if (query.branch_id) {
      params.push(query.branch_id);
      conditions.push(`s.branch_id = $${params.length}`);
    }

    const where = conditions.join(' AND ');

    const countRows = await this.db.query(
      `SELECT COUNT(*)::int AS total
       FROM subscription_refund_candidates src
       LEFT JOIN subscriptions s ON s.subscription_id = src.subscription_id
       WHERE ${where}`,
      params,
    );
    const total = countRows?.[0]?.total ?? 0;

    params.push(limit, offset);
    const rows = await this.db.query(
      `SELECT
         src.*,
         u.first_name || ' ' || u.last_name AS customer_name,
         u.phone AS customer_phone,
         s.subscription_number,
         p.name  AS product_name,
         pv.name AS variant_name,
         o.order_number
       FROM subscription_refund_candidates src
       LEFT JOIN subscriptions s        ON s.subscription_id = src.subscription_id
       LEFT JOIN users u                ON u.user_id = src.customer_id
       LEFT JOIN subscription_items si  ON si.subscription_item_id = src.subscription_item_id
                                       OR si.id::text = src.subscription_item_id
       LEFT JOIN product_variants pv    ON pv.variant_id = si.product_variant_id
       LEFT JOIN products p             ON p.product_id = pv.product_id
       LEFT JOIN orders o               ON o.order_id::text = src.order_id
       WHERE ${where}
       ORDER BY src.scheduled_date DESC, src.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { rows: rows ?? [], total };
  }

  // ─── Customer Groups (for accordion UI) ─────────────────────────────────────

  async getCustomerGroups(query: any): Promise<any[]> {
    const conditions: string[] = ["src.deleted_at IS NULL", "src.status = 'pending'"];
    const params: any[] = [];

    if (query.customer_id) {
      params.push(query.customer_id);
      conditions.push(`src.customer_id = $${params.length}`);
    }
    if (query.date_from) {
      params.push(query.date_from);
      conditions.push(`src.scheduled_date >= $${params.length}`);
    }
    if (query.date_to) {
      params.push(query.date_to);
      conditions.push(`src.scheduled_date <= $${params.length}`);
    }

    const where = conditions.join(' AND ');

    const rows = await this.db.query(
      `SELECT
         src.customer_id,
         u.first_name || ' ' || u.last_name AS customer_name,
         u.phone AS customer_phone,
         COUNT(src.refund_candidate_id)::int AS pending_deliveries,
         COALESCE(SUM(src.refund_amount),0)::numeric AS pending_refund_amount,
         json_agg(
           json_build_object(
             'refund_candidate_id', src.refund_candidate_id,
             'subscription_id', src.subscription_id,
             'subscription_item_id', src.subscription_item_id,
             'subscription_number', s.subscription_number,
             'order_id', src.order_id,
             'order_number', o.order_number,
             'scheduled_date', src.scheduled_date,
             'delivery_slot', src.delivery_slot,
             'quantity', src.quantity,
             'unit_price', src.unit_price,
             'final_price', src.final_price,
             'refund_amount', src.refund_amount,
             'refund_reason', src.refund_reason,
             'source', src.source,
             'product_name', p.name,
             'variant_name', pv.name
           ) ORDER BY src.scheduled_date ASC
         ) AS deliveries
       FROM subscription_refund_candidates src
       LEFT JOIN subscriptions s        ON s.subscription_id = src.subscription_id
       LEFT JOIN users u                ON u.user_id = src.customer_id
       LEFT JOIN subscription_items si  ON si.subscription_item_id = src.subscription_item_id
                                       OR si.id::text = src.subscription_item_id
       LEFT JOIN product_variants pv    ON pv.variant_id = si.product_variant_id
       LEFT JOIN products p             ON p.product_id = pv.product_id
       LEFT JOIN orders o               ON o.order_id::text = src.order_id
       WHERE ${where}
       GROUP BY src.customer_id, u.first_name, u.last_name, u.phone
       ORDER BY pending_refund_amount DESC`,
      params,
    );
    return rows ?? [];
  }

  // ─── Approve candidates (bulk) ───────────────────────────────────────────────

  async approveCandidates(
    candidateIds: string[],
    payoutId: string,
    adminId: string,
  ): Promise<number> {
    if (!candidateIds.length) return 0;
    const now = new Date().toISOString();
    const result = await this.db.query(
      `UPDATE subscription_refund_candidates
       SET status = 'approved',
           refund_payout_id = $1,
           approved_by = $2,
           approved_at = $3,
           updated_at = $3
       WHERE refund_candidate_id = ANY($4::varchar[])
         AND status = 'pending'
         AND deleted_at IS NULL
       RETURNING refund_candidate_id`,
      [payoutId, adminId, now, candidateIds],
    );
    return result?.length ?? 0;
  }

  // ─── Mark candidates refunded ────────────────────────────────────────────────

  async markRefunded(payoutId: string): Promise<void> {
    await this.db.query(
      `UPDATE subscription_refund_candidates
       SET status = 'refunded', updated_at = NOW()
       WHERE refund_payout_id = $1 AND status = 'approved'`,
      [payoutId],
    );
  }

  // ─── Reject candidates (bulk) ────────────────────────────────────────────────

  async rejectCandidates(
    candidateIds: string[],
    adminId: string,
    notes?: string,
  ): Promise<number> {
    if (!candidateIds.length) return 0;
    const now = new Date().toISOString();
    const result = await this.db.query(
      `UPDATE subscription_refund_candidates
       SET status = 'rejected',
           approved_by = $1,
           approved_at = $2,
           notes = COALESCE($3, notes),
           updated_at = $2
       WHERE refund_candidate_id = ANY($4::varchar[])
         AND status = 'pending'
         AND deleted_at IS NULL
       RETURNING refund_candidate_id`,
      [adminId, now, notes ?? null, candidateIds],
    );
    return result?.length ?? 0;
  }

  // ─── Get candidates by IDs ───────────────────────────────────────────────────

  async getCandidatesByIds(candidateIds: string[]): Promise<any[]> {
    if (!candidateIds.length) return [];
    const rows = await this.db.query(
      `SELECT * FROM subscription_refund_candidates
       WHERE refund_candidate_id = ANY($1::varchar[])
         AND deleted_at IS NULL`,
      [candidateIds],
    );
    return rows ?? [];
  }

  // ─── Remaining scheduled days for a subscription (for cancellation) ──────────

  async getRemainingScheduledDays(
    subscriptionId: string,
    fromDate: string,
  ): Promise<any[]> {
    // Returns all unique (item, date, slot) combinations from subscription_weekly_schedule
    // for dates >= fromDate that don't already have an order or a refund candidate.
    const rows = await this.db.query(
      `SELECT
         si.subscription_item_id,
         si.id::text AS si_raw_id,
         si.subscription_id,
         si.product_variant_id,
         si.unit_price,
         si.final_price,
         gs.dt::date AS scheduled_date,
         CASE WHEN ws.m_quantity > 0 THEN 'morning' ELSE NULL END AS morning_slot,
         CASE WHEN ws.e_quantity > 0 THEN 'evening' ELSE NULL END AS evening_slot,
         COALESCE(ws.m_quantity, 0) AS m_quantity,
         COALESCE(ws.e_quantity, 0) AS e_quantity,
         s.customer_id
       FROM subscriptions s
       JOIN subscription_items si ON si.subscription_id = s.subscription_id AND si.status = 'active'
       JOIN subscription_weekly_schedule ws ON ws.subscription_item_id = si.subscription_item_id
                                           OR ws.subscription_item_id = si.id::text
       -- Generate series of dates from fromDate to end_date
       JOIN LATERAL generate_series(
         GREATEST($2::date, $2::date),
         COALESCE(s.end_date::date, CURRENT_DATE + INTERVAL '365 days'),
         '1 day'::interval
       ) AS gs(dt) ON EXTRACT(DOW FROM gs.dt) = ANY(
         -- Expand day_of_week flags to numeric DOW (0=Sun...6=Sat)
         ARRAY(SELECT unnest(ARRAY[0,1,2,3,4,5,6])
               WHERE ws.day_of_week IS NULL OR ws.day_of_week::text LIKE '%' || unnest || '%')
       )
       WHERE s.subscription_id = $1
         AND s.payment_type = 'prepaid'
         AND gs.dt >= $2::date
       ORDER BY gs.dt ASC, si.subscription_item_id ASC`,
      [subscriptionId, fromDate],
    );
    return rows ?? [];
  }

  // ─── Payouts ─────────────────────────────────────────────────────────────────

  async createPayout(payout: {
    refund_number: string;
    customer_id: string;
    total_amount: number;
    total_deliveries: number;
    approved_by: string;
  }): Promise<string> {
    const rows = await this.db.query(
      `INSERT INTO subscription_refund_payouts
         (refund_number, customer_id, total_amount, total_deliveries, approved_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING refund_payout_id`,
      [
        payout.refund_number,
        payout.customer_id,
        payout.total_amount,
        payout.total_deliveries,
        payout.approved_by,
      ],
    );
    return rows[0].refund_payout_id;
  }

  async getPayouts(query: any): Promise<{ rows: any[]; total: number }> {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (query.status) {
      params.push(query.status);
      conditions.push(`srp.status = $${params.length}`);
    }
    if (query.customer_id) {
      params.push(query.customer_id);
      conditions.push(`srp.customer_id = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRows = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM subscription_refund_payouts srp ${where}`,
      params,
    );
    const total = countRows?.[0]?.total ?? 0;

    params.push(limit, offset);
    const rows = await this.db.query(
      `SELECT
         srp.*,
         u.first_name || ' ' || u.last_name AS customer_name,
         u.phone AS customer_phone
       FROM subscription_refund_payouts srp
       LEFT JOIN users u ON u.user_id = srp.customer_id
       ${where}
       ORDER BY srp.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { rows: rows ?? [], total };
  }

  async getPayoutById(payoutId: string): Promise<any | null> {
    const rows = await this.db.query(
      `SELECT
         srp.*,
         u.first_name || ' ' || u.last_name AS customer_name,
         u.phone AS customer_phone,
         json_agg(
           json_build_object(
             'refund_candidate_id', src.refund_candidate_id,
             'subscription_id', src.subscription_id,
             'subscription_number', s.subscription_number,
             'scheduled_date', src.scheduled_date,
             'delivery_slot', src.delivery_slot,
             'quantity', src.quantity,
             'refund_amount', src.refund_amount,
             'refund_reason', src.refund_reason,
             'product_name', p.name,
             'variant_name', pv.name,
             'status', src.status
           ) ORDER BY src.scheduled_date ASC
         ) AS candidates
       FROM subscription_refund_payouts srp
       LEFT JOIN users u ON u.user_id = srp.customer_id
       LEFT JOIN subscription_refund_candidates src ON src.refund_payout_id = srp.refund_payout_id
       LEFT JOIN subscriptions s ON s.subscription_id = src.subscription_id
       LEFT JOIN subscription_items si ON si.subscription_item_id = src.subscription_item_id
                                       OR si.id::text = src.subscription_item_id
       LEFT JOIN product_variants pv ON pv.variant_id = si.product_variant_id
       LEFT JOIN products p ON p.product_id = pv.product_id
       WHERE srp.refund_payout_id = $1
       GROUP BY srp.refund_payout_id, u.first_name, u.last_name, u.phone`,
      [payoutId],
    );
    return rows?.[0] ?? null;
  }

  async updatePayoutProcessed(
    payoutId: string,
    walletTxId: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE subscription_refund_payouts
       SET status = 'processed',
           wallet_transaction_id = $1,
           processed_at = NOW(),
           updated_at = NOW()
       WHERE refund_payout_id = $2`,
      [walletTxId, payoutId],
    );
  }

  // ─── Wallet helpers ──────────────────────────────────────────────────────────

  async creditCustomerWallet(
    customerId: string,
    amount: number,
    payoutId: string,
    refundNumber: string,
  ): Promise<string> {
    // 1. Fetch current balance
    const custRows = await this.db.query(
      `SELECT wallet_balance FROM customers WHERE customer_id = $1 LIMIT 1`,
      [customerId],
    );
    const currentBalance = Number(custRows?.[0]?.wallet_balance ?? 0);
    const newBalance = currentBalance + amount;

    // 2. Update wallet balance
    await this.db.query(
      `UPDATE customers SET wallet_balance = $1, updated_at = NOW() WHERE customer_id = $2`,
      [newBalance, customerId],
    );

    // 3. Insert wallet transaction
    const ts = Math.floor(Date.now() / 1000).toString(36);
    const rnd = Math.floor(Math.random() * 9000 + 1000);
    const txId = `WR${ts}${rnd}`;

    await this.db.query(
      `INSERT INTO customer_wallet_transactions
         (transaction_id, customer_id, transaction_type, amount, balance_after,
          reference_type, reference_id, remarks, created_at)
       VALUES ($1, $2, 'credit', $3, $4, 'subscription_refund', $5, $6, NOW())`,
      [
        txId,
        customerId,
        amount,
        newBalance,
        payoutId,
        `Subscription refund ${refundNumber}`,
      ],
    );

    return txId;
  }
}
