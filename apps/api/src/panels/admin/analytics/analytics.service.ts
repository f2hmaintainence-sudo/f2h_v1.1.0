import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../../shared/database/Database.service';
import { DeveloperService } from '../../../shared/logger/Developer.service';
import { PdfService } from '../../../common/pdf/pdf.service';
import { WalletLedgerService } from '../../../shared/payments/wallet-ledger.service';

function formatMoney(v: unknown): string {
  return '₹' + Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly pdfService: PdfService,
    private readonly walletLedger: WalletLedgerService,
  ) { }

  async getRevenueReport(query: any) {
    try {
      const days = parseInt(query.days || '30', 10);
      const sql = `
        SELECT
          scheduled_date AS day,
          COUNT(*)::int AS orders,
          COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled'), 0)::numeric AS revenue,
          COALESCE(SUM(discount_amount) FILTER (WHERE status != 'cancelled'), 0)::numeric AS discounts,
          COUNT(*) FILTER (WHERE order_source = 'subscription')::int AS sub_orders,
          COUNT(*) FILTER (WHERE order_source = 'one-time')::int AS onetime_orders
        FROM orders
        WHERE scheduled_date >= CURRENT_DATE - ($1 || ' days')::interval
        GROUP BY scheduled_date ORDER BY scheduled_date ASC
      `;
      const rows = await this.db.query(sql, [days]);
      const totals = rows.reduce((a: any, r: any) => ({
        total_revenue: a.total_revenue + Number(r.revenue),
        total_orders: a.total_orders + r.orders,
        total_discounts: a.total_discounts + Number(r.discounts),
      }), { total_revenue: 0, total_orders: 0, total_discounts: 0 });

      return { status: true, data: { daily: rows.map((r: any) => ({ ...r, revenue: Number(r.revenue), discounts: Number(r.discounts) })), totals }, message: 'Revenue report fetched' };
    } catch (error) {
      this.developer.error('getRevenueReport error', { error });
      throw new InternalServerErrorException('Failed to retrieve revenue report');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Full revenue & payments report
  //
  // Money is recognised from `orders` (the row that carries branch, source and
  // payment mode) and reconciled against `customer_bills` for collection and
  // ageing. Cancelled, failed and rejected orders never count as revenue.
  // ══════════════════════════════════════════════════════════════════════════

  /** Resolves the reporting window from either explicit dates or a day count. */
  private resolveRange(query: any): { from: string; to: string } {
    const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (isDate(query?.from) && isDate(query?.to)) {
      return query.from <= query.to
        ? { from: query.from, to: query.to }
        : { from: query.to, to: query.from };
    }
    const days = Math.min(Math.max(parseInt(query?.days ?? '30', 10) || 30, 1), 366);
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86400000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { from: iso(from), to: iso(to) };
  }

  async getRevenuePaymentsReport(query: any) {
    try {
      const { from, to } = this.resolveRange(query);

      // Shared filters. $1/$2 are always the window; the rest are appended.
      const params: any[] = [from, to];
      const where: string[] = [
        'o.deleted_at IS NULL',
        'o.scheduled_date BETWEEN $1 AND $2',
        "o.status NOT IN ('cancelled', 'failed', 'rejected')",
      ];

      if (query?.branch_id) {
        params.push(query.branch_id);
        where.push(`o.branch_id = $${params.length}`);
      }
      if (query?.order_source) {
        params.push(query.order_source);
        where.push(`o.order_source = $${params.length}`);
      }
      if (query?.payment_mode) {
        params.push(query.payment_mode);
        where.push(
          `COALESCE(NULLIF(TRIM(o.payment_mode), ''), 'unspecified') = $${params.length}`,
        );
      }
      const scope = where.join(' AND ');

      // Reusable money expressions
      const PAID = "o.payment_status = 'paid'";
      const MODE = "COALESCE(NULLIF(TRIM(o.payment_mode), ''), 'unspecified')";
      const SOURCE = "COALESCE(NULLIF(TRIM(o.order_source), ''), 'one-time')";

      const [totalsRows, daily, byBranch, byMode, bySource, billRows, ageingRows] =
        await Promise.all([
          // ── Headline totals ──
          this.db.query(
            `SELECT
               COALESCE(SUM(o.total_amount), 0)::numeric                                  AS gross_revenue,
               COALESCE(SUM(o.total_amount) FILTER (WHERE ${PAID}), 0)::numeric           AS collected,
               COALESCE(SUM(o.total_amount) FILTER (WHERE NOT (${PAID})), 0)::numeric     AS outstanding,
               COALESCE(SUM(o.discount_amount), 0)::numeric                               AS discounts,
               COALESCE(SUM(o.gst_amount), 0)::numeric                                    AS tax,
               COUNT(*)::int                                                              AS orders,
               COUNT(DISTINCT o.customer_id)::int                                         AS customers,
               COALESCE(SUM(o.total_amount) FILTER (WHERE ${SOURCE} = 'subscription'), 0)::numeric AS subscription_revenue,
               COALESCE(SUM(o.total_amount) FILTER (WHERE ${SOURCE} <> 'subscription'), 0)::numeric AS onetime_revenue,
               COUNT(*) FILTER (WHERE ${SOURCE} = 'subscription')::int                    AS subscription_orders,
               COUNT(*) FILTER (WHERE ${SOURCE} <> 'subscription')::int                   AS onetime_orders
             FROM orders o
             WHERE ${scope}`,
            params,
          ),

          // ── Daily trend ──
          this.db.query(
            `SELECT
               o.scheduled_date::text                                                     AS day,
               COUNT(*)::int                                                              AS orders,
               COALESCE(SUM(o.total_amount), 0)::numeric                                  AS revenue,
               COALESCE(SUM(o.total_amount) FILTER (WHERE ${PAID}), 0)::numeric           AS collected,
               COALESCE(SUM(o.total_amount) FILTER (WHERE ${SOURCE} = 'subscription'), 0)::numeric AS subscription_revenue,
               COALESCE(SUM(o.total_amount) FILTER (WHERE ${SOURCE} <> 'subscription'), 0)::numeric AS onetime_revenue
             FROM orders o
             WHERE ${scope}
             GROUP BY o.scheduled_date
             ORDER BY o.scheduled_date ASC`,
            params,
          ),

          // ── Branch-wise ──
          this.db.query(
            `SELECT
               o.branch_id,
               COALESCE(b.branch_name, 'Unassigned')                                      AS branch_name,
               COUNT(*)::int                                                              AS orders,
               COUNT(DISTINCT o.customer_id)::int                                         AS customers,
               COALESCE(SUM(o.total_amount), 0)::numeric                                  AS revenue,
               COALESCE(SUM(o.total_amount) FILTER (WHERE ${PAID}), 0)::numeric           AS collected,
               COALESCE(SUM(o.total_amount) FILTER (WHERE NOT (${PAID})), 0)::numeric     AS outstanding,
               COALESCE(SUM(o.total_amount) FILTER (WHERE ${SOURCE} = 'subscription'), 0)::numeric AS subscription_revenue,
               COALESCE(SUM(o.total_amount) FILTER (WHERE ${SOURCE} <> 'subscription'), 0)::numeric AS onetime_revenue
             FROM orders o
             LEFT JOIN branches b ON b.branch_id = o.branch_id
             WHERE ${scope}
             GROUP BY o.branch_id, b.branch_name
             ORDER BY revenue DESC`,
            params,
          ),

          // ── Payment-type-wise ──
          this.db.query(
            `SELECT
               ${MODE}                                                                    AS payment_mode,
               COUNT(*)::int                                                              AS orders,
               COALESCE(SUM(o.total_amount), 0)::numeric                                  AS revenue,
               COALESCE(SUM(o.total_amount) FILTER (WHERE ${PAID}), 0)::numeric           AS collected,
               COALESCE(SUM(o.total_amount) FILTER (WHERE NOT (${PAID})), 0)::numeric     AS outstanding
             FROM orders o
             WHERE ${scope}
             GROUP BY ${MODE}
             ORDER BY revenue DESC`,
            params,
          ),

          // ── Subscription vs one-time ──
          this.db.query(
            `SELECT
               ${SOURCE}                                                                  AS source,
               COUNT(*)::int                                                              AS orders,
               COUNT(DISTINCT o.customer_id)::int                                         AS customers,
               COALESCE(SUM(o.total_amount), 0)::numeric                                  AS revenue,
               COALESCE(SUM(o.total_amount) FILTER (WHERE ${PAID}), 0)::numeric           AS collected,
               COALESCE(AVG(o.total_amount), 0)::numeric                                  AS avg_order_value
             FROM orders o
             WHERE ${scope}
             GROUP BY ${SOURCE}
             ORDER BY revenue DESC`,
            params,
          ),

          // ── Billing: prepaid vs postpaid ──
          this.db.query(
            `SELECT
               COALESCE(NULLIF(TRIM(cb.payment_type), ''), 'unspecified')                 AS payment_type,
               COALESCE(NULLIF(TRIM(cb.bill_type), ''), 'other')                          AS bill_type,
               COUNT(*)::int                                                              AS bills,
               COALESCE(SUM(cb.total_amount), 0)::numeric                                 AS billed,
               COALESCE(SUM(cb.paid_amount), 0)::numeric                                  AS paid,
               COALESCE(SUM(cb.due_amount), 0)::numeric                                   AS due
             FROM customer_bills cb
             WHERE cb.deleted_at IS NULL
               AND cb.created_at::date BETWEEN $1 AND $2
             GROUP BY 1, 2
             ORDER BY billed DESC`,
            [from, to],
          ),

          // ── Collection ageing: settled on time vs overdue ──
          this.db.query(
            `SELECT
               COUNT(*) FILTER (WHERE cb.due_amount <= 0)::int                            AS settled_bills,
               COALESCE(SUM(cb.paid_amount) FILTER (WHERE cb.due_amount <= 0), 0)::numeric AS settled_amount,
               COUNT(*) FILTER (WHERE cb.due_amount > 0 AND cb.due_date >= CURRENT_DATE)::int AS due_bills,
               COALESCE(SUM(cb.due_amount) FILTER (WHERE cb.due_amount > 0 AND cb.due_date >= CURRENT_DATE), 0)::numeric AS due_amount,
               COUNT(*) FILTER (WHERE cb.due_amount > 0 AND cb.due_date < CURRENT_DATE)::int AS overdue_bills,
               COALESCE(SUM(cb.due_amount) FILTER (WHERE cb.due_amount > 0 AND cb.due_date < CURRENT_DATE), 0)::numeric AS overdue_amount
             FROM customer_bills cb
             WHERE cb.deleted_at IS NULL
               AND cb.created_at::date BETWEEN $1 AND $2`,
            [from, to],
          ),
        ]);

      const num = (v: unknown) => Number(v ?? 0);
      const t = totalsRows?.[0] ?? {};
      const gross = num(t.gross_revenue);

      const totals = {
        gross_revenue: gross,
        collected: num(t.collected),
        outstanding: num(t.outstanding),
        discounts: num(t.discounts),
        tax: num(t.tax),
        orders: num(t.orders),
        customers: num(t.customers),
        subscription_revenue: num(t.subscription_revenue),
        onetime_revenue: num(t.onetime_revenue),
        subscription_orders: num(t.subscription_orders),
        onetime_orders: num(t.onetime_orders),
        avg_order_value: num(t.orders) ? gross / num(t.orders) : 0,
        collection_rate: gross ? (num(t.collected) / gross) * 100 : 0,
      };

      const shareOf = (v: unknown) => (gross ? (num(v) / gross) * 100 : 0);

      return {
        status: true,
        data: {
          range: { from, to },
          filters: {
            branch_id: query?.branch_id ?? null,
            order_source: query?.order_source ?? null,
            payment_mode: query?.payment_mode ?? null,
          },
          totals,
          daily: (daily ?? []).map((r: any) => ({
            day: r.day,
            orders: num(r.orders),
            revenue: num(r.revenue),
            collected: num(r.collected),
            subscription_revenue: num(r.subscription_revenue),
            onetime_revenue: num(r.onetime_revenue),
          })),
          by_branch: (byBranch ?? []).map((r: any) => ({
            branch_id: r.branch_id,
            branch_name: r.branch_name,
            orders: num(r.orders),
            customers: num(r.customers),
            revenue: num(r.revenue),
            collected: num(r.collected),
            outstanding: num(r.outstanding),
            subscription_revenue: num(r.subscription_revenue),
            onetime_revenue: num(r.onetime_revenue),
            share_pct: shareOf(r.revenue),
          })),
          by_payment_mode: (byMode ?? []).map((r: any) => ({
            payment_mode: r.payment_mode,
            orders: num(r.orders),
            revenue: num(r.revenue),
            collected: num(r.collected),
            outstanding: num(r.outstanding),
            share_pct: shareOf(r.revenue),
          })),
          by_source: (bySource ?? []).map((r: any) => ({
            source: r.source,
            orders: num(r.orders),
            customers: num(r.customers),
            revenue: num(r.revenue),
            collected: num(r.collected),
            avg_order_value: num(r.avg_order_value),
            share_pct: shareOf(r.revenue),
          })),
          billing: {
            by_payment_type: (billRows ?? []).map((r: any) => ({
              payment_type: r.payment_type,
              bill_type: r.bill_type,
              bills: num(r.bills),
              billed: num(r.billed),
              paid: num(r.paid),
              due: num(r.due),
            })),
            collection: {
              settled_bills: num(ageingRows?.[0]?.settled_bills),
              settled_amount: num(ageingRows?.[0]?.settled_amount),
              due_bills: num(ageingRows?.[0]?.due_bills),
              due_amount: num(ageingRows?.[0]?.due_amount),
              overdue_bills: num(ageingRows?.[0]?.overdue_bills),
              overdue_amount: num(ageingRows?.[0]?.overdue_amount),
            },
          },
        },
        message: 'Revenue and payments report fetched',
      };
    } catch (error) {
      this.developer.error('getRevenuePaymentsReport error', { error, query });
      throw new InternalServerErrorException('Failed to retrieve revenue report');
    }
  }

  async getSubscriptionRevenue(query: any) {
    try {
      const days = parseInt(query.days || '30', 10);
      const sql = `
        SELECT scheduled_date AS day, COUNT(*)::int AS orders,
          COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled'), 0)::numeric AS revenue
        FROM orders WHERE order_source = 'subscription'
          AND scheduled_date >= CURRENT_DATE - ($1 || ' days')::interval
        GROUP BY scheduled_date ORDER BY scheduled_date ASC
      `;
      const rows = await this.db.query(sql, [days]);
      return { status: true, data: rows.map((r: any) => ({ ...r, revenue: Number(r.revenue) })), message: 'Subscription revenue fetched' };
    } catch (error) {
      this.developer.error('getSubscriptionRevenue error', { error });
      throw new InternalServerErrorException('Failed');
    }
  }

  async getWalletReport(_query: any) {
    try {
      const sql = `
        SELECT
          COUNT(*)::int AS total_wallets,
          COALESCE(SUM(wallet_balance), 0)::numeric AS total_balance,
          COUNT(*) FILTER (WHERE wallet_balance > 0)::int AS active_wallets,
          COALESCE(AVG(wallet_balance), 0)::numeric AS avg_balance,
          COALESCE(MAX(wallet_balance), 0)::numeric AS max_balance
        FROM customers
      `;
      const rows = await this.db.query(sql);
      return { status: true, data: rows[0] ?? {}, message: 'Wallet report fetched' };
    } catch (error) {
      this.developer.error('getWalletReport error', { error });
      throw new InternalServerErrorException('Failed');
    }
  }


 async getOutstandingBalances(_query: any) {
  try {
    const sql = `
      SELECT
        c.customer_id,
        u.first_name,
        u.last_name,
        u.phone,
        COALESCE(c.wallet_balance, 0)::numeric AS wallet_balance,
        (
          SELECT COALESCE(SUM(o.total_amount), 0)::numeric
          FROM orders o
          WHERE o.customer_id = c.customer_id
            AND o.payment_status = 'pending'
            AND o.status != 'cancelled'
        ) AS pending_amount
      FROM customers c
      JOIN users u ON u.user_id = c.customer_id
      WHERE
        COALESCE(c.wallet_balance, 0) < 0
        OR (
          SELECT COALESCE(SUM(o.total_amount), 0)
          FROM orders o
          WHERE o.customer_id = c.customer_id
            AND o.payment_status = 'pending'
            AND o.status != 'cancelled'
        ) > 0
      ORDER BY pending_amount DESC
      LIMIT 100
    `;

    const rows = await this.db.query(sql);

    return {
      status: true,
      data: rows,
      message: 'Outstanding balances fetched',
    };
  } catch (error) {
    this.developer.error('getOutstandingBalances error', { error });
    throw new InternalServerErrorException('Failed');
  }
}

  async getRefundReport(query: any) {
    try {
      const days = parseInt(query.days || '30', 10);
      const sql = `
        SELECT status, refund_method, SUM(count)::int AS count, SUM(total_amount)::numeric AS total_amount
        FROM (
          SELECT status::text AS status, refund_type::text AS refund_method,
            COUNT(*)::int AS count,
            COALESCE(SUM(refund_amount), 0)::numeric AS total_amount
          FROM refunds WHERE created_at >= CURRENT_DATE - ($1::text || ' days')::interval
          GROUP BY status, refund_type

          UNION ALL

          SELECT COALESCE(status, 'pending')::text AS status, 'wallet_deposit' AS refund_method,
            COUNT(*)::int AS count,
            COALESCE(SUM(refund_amount), 0)::numeric AS total_amount
          FROM subscription_refunds WHERE created_at >= CURRENT_DATE - ($1::text || ' days')::interval
          GROUP BY status
        ) combined
        GROUP BY status, refund_method
        ORDER BY count DESC
      `;
      const rows = await this.db.query(sql, [days]);
      return { status: true, data: (rows || []).map((r: any) => ({ ...r, total_amount: Number(r.total_amount) })), message: 'Refund report fetched' };
    } catch (error) {
      this.developer.error('getRefundReport error', { error });
      throw new InternalServerErrorException('Failed to fetch refund report');
    }
  }

  async getRefundsList(query: any) {
    try {
      const days = parseInt(query.days || '30', 10);
      const sql = `
        SELECT 
          id::text AS id,
          COALESCE(refund_number, id::text) AS refund_number,
          customer_id,
          order_id,
          refund_amount,
          refund_type::text AS refund_type,
          status::text AS status,
          reason,
          created_at,
          'order_refund' AS category
        FROM refunds 
        WHERE created_at >= CURRENT_DATE - ($1::text || ' days')::interval

        UNION ALL

        SELECT 
          sr.id::text AS id,
          sr.id::text AS refund_number,
          sr.customer_id,
          sr.subscription_id AS order_id,
          sr.refund_amount,
          'wallet_deposit' AS refund_type,
          COALESCE(sr.status, 'pending')::text AS status,
          ('Subscription pause refund for ' || sr.total_paused_days || ' days (' || sr.refund_month || ')') AS reason,
          sr.created_at,
          'subscription_pause_refund' AS category
        FROM subscription_refunds sr
        WHERE sr.created_at >= CURRENT_DATE - ($1::text || ' days')::interval

        ORDER BY created_at DESC
      `;
      const rows = await this.db.query(sql, [days]);
      return { status: true, data: rows || [], message: 'Refunds list fetched' };
    } catch (error) {
      this.developer.error('getRefundsList error', { error });
      throw new InternalServerErrorException('Failed to fetch refunds list');
    }
  }

  async processRefund(refundId: string) {
    try {
      // 1. Check if in subscription_refunds
      const subRefundRes = await this.db.query(
        `SELECT * FROM subscription_refunds WHERE id = $1 LIMIT 1`,
        [refundId]
      );

      if (subRefundRes && subRefundRes.length > 0) {
        const sr = subRefundRes[0];
        if (sr.status === 'processed') {
          return { status: true, message: 'Refund is already processed' };
        }

        const refundAmount = Number(sr.refund_amount || 0);

        // The wallet is written by WalletLedgerService alone: it locks the
        // balance FOR UPDATE and commits the ledger row in the same transaction.
        // The previous inline read-modify-write here could lose concurrent
        // credits, and it marked *every* pause on the subscription as refunded
        // regardless of which month the refund covered.
        const credit = await this.walletLedger.credit({
          customerId: sr.customer_id,
          amount: refundAmount,
          referenceType: 'subscription_pause_refund',
          referenceId: String(refundId),
          remarks: `Refund for ${sr.total_paused_days} paused days in ${sr.refund_month}`,
          createdBy: 'system',
        });

        await this.db.query(
          `UPDATE subscription_refunds SET status = 'processed', wallet_transaction_id = $1 WHERE id = $2`,
          [credit.transactionId, refundId]
        );

        // Only the pauses this refund actually covers — bounded by the month it
        // was raised for, not the whole subscription history.
        await this.db.query(
          `UPDATE subscription_pauses
              SET is_refunded = true, updated_at = NOW()
            WHERE subscription_id = $1
              AND is_refunded = false
              AND deleted_at IS NULL
              AND to_char(start_date, 'YYYY-MM') <= $2
              AND to_char(end_date, 'YYYY-MM') >= $2`,
          [sr.subscription_id, sr.refund_month]
        );

        return {
          status: true,
          message: `Refund ₹${refundAmount} processed and credited to customer wallet successfully.`,
          new_balance: credit.balanceAfter
        };
      }

      // 2. Check if in refunds table
      const refundRes = await this.db.query(
        `SELECT * FROM refunds WHERE id::text = $1 OR refund_number = $1 LIMIT 1`,
        [refundId]
      );

      if (refundRes && refundRes.length > 0) {
        const r = refundRes[0];
        const refundAmount = Number(r.refund_amount || 0);

        if (r.status === 'processed') {
          return { status: true, message: 'Refund is already processed' };
        }

        const credit = await this.walletLedger.credit({
          customerId: r.customer_id,
          amount: refundAmount,
          referenceType: 'order_refund',
          referenceId: String(r.order_id || r.id),
          remarks: `Order refund ${r.refund_number || r.id}`,
          createdBy: 'system',
        });

        await this.db.query(
          `UPDATE refunds
              SET status = 'processed', processed_at = NOW(),
                  transaction_id = $1, updated_at = NOW()
            WHERE id = $2`,
          [credit.transactionId, r.id]
        );

        return {
          status: true,
          message: `Order refund ₹${refundAmount} processed and credited to customer wallet successfully.`,
          new_balance: credit.balanceAfter
        };
      }

      throw new BadRequestException('Refund record not found');
    } catch (error) {
      this.developer.error('processRefund error', { error });
      throw new InternalServerErrorException('Failed to process refund');
    }
  }

  async getCustomerGrowth(query: any) {
    try {
      const days = parseInt(query.days || '30', 10);
      const sql = `
        WITH ds AS (SELECT generate_series(CURRENT_DATE - ($1 || ' days')::interval, CURRENT_DATE, '1 day')::date AS day)
        SELECT ds.day, COALESCE(COUNT(c.customer_id), 0)::int AS new_customers,
          (SELECT COUNT(*)::int FROM customers WHERE created_at::date <= ds.day) AS cumulative
        FROM ds LEFT JOIN customers c ON c.created_at::date = ds.day
        GROUP BY ds.day ORDER BY ds.day ASC
      `;
      const rows = await this.db.query(sql, [days]);
      return { status: true, data: rows, message: 'Customer growth fetched' };
    } catch (error) {
      this.developer.error('getCustomerGrowth error', { error });
      throw new InternalServerErrorException('Failed');
    }
  }

  async getSubscriptionGrowth(query: any) {
    try {
      const days = parseInt(query.days || '30', 10);
      const sql = `
        WITH ds AS (SELECT generate_series(CURRENT_DATE - ($1 || ' days')::interval, CURRENT_DATE, '1 day')::date AS day)
        SELECT ds.day, COALESCE(COUNT(s.id), 0)::int AS new_subscriptions,
          (SELECT COUNT(*)::int FROM subscriptions WHERE status = 'active' AND created_at::date <= ds.day) AS active_cumulative
        FROM ds LEFT JOIN subscriptions s ON s.created_at::date = ds.day
        GROUP BY ds.day ORDER BY ds.day ASC
      `;
      const rows = await this.db.query(sql, [days]);
      return { status: true, data: rows, message: 'Subscription growth fetched' };
    } catch (error) {
      this.developer.error('getSubscriptionGrowth error', { error });
      throw new InternalServerErrorException('Failed');
    }
  }

  async getRetention(query: any) {
    try {
      const days = parseInt(query.days || '90', 10);
      const sql = `
        WITH monthly AS (
          SELECT DATE_TRUNC('month', scheduled_date)::date AS month, customer_id
          FROM orders WHERE scheduled_date >= CURRENT_DATE - ($1 || ' days')::interval
            AND status = 'delivered' GROUP BY 1, 2
        ),
        retention AS (
          SELECT m1.month, COUNT(DISTINCT m1.customer_id)::int AS total,
            COUNT(DISTINCT m2.customer_id)::int AS retained
          FROM monthly m1
          LEFT JOIN monthly m2 ON m2.customer_id = m1.customer_id
            AND m2.month = m1.month + INTERVAL '1 month'
          GROUP BY m1.month
        )
        SELECT month, total, retained,
          ROUND(retained::numeric / NULLIF(total, 0) * 100, 1)::numeric AS retention_rate,
          (total - retained) AS churned
        FROM retention ORDER BY month ASC
      `;
      const rows = await this.db.query(sql, [days]);
      return { status: true, data: rows.map((r: any) => ({ ...r, retention_rate: Number(r.retention_rate ?? 0) })), message: 'Retention data fetched' };
    } catch (error) {
      this.developer.error('getRetention error', { error });
      throw new InternalServerErrorException('Failed');
    }
  }

  async getProductPerformance(query: any) {
    try {
      const days = parseInt(query.days || '30', 10);
      const sql = `
        SELECT p.product_id, p.name AS product_name, pv.variant_id, pv.name AS variant_name,
          SUM(oi.quantity)::int AS total_qty,
          COUNT(DISTINCT oi.order_id)::int AS order_count,
          COALESCE(SUM(oi.final_price), 0)::numeric AS revenue
        FROM order_items oi
        JOIN product_variants pv ON pv.variant_id = oi.variant_id
        JOIN products p ON p.product_id = pv.product_id
        JOIN orders o ON o.order_id = oi.order_id
        WHERE o.scheduled_date >= CURRENT_DATE - ($1 || ' days')::interval
          AND o.status != 'cancelled'
        GROUP BY p.product_id, p.name, pv.variant_id, pv.name
        ORDER BY revenue DESC LIMIT 50
      `;
      const rows = await this.db.query(sql, [days]);
      return { status: true, data: rows.map((r: any) => ({ ...r, revenue: Number(r.revenue) })), message: 'Product performance fetched' };
    } catch (error) {
      this.developer.error('getProductPerformance error', { error });
      throw new InternalServerErrorException('Failed');
    }
  }

  async getBranchPerformance(query: any) {
    try {
      const days = parseInt(query.days || '30', 10);
      const sql = `
        SELECT b.branch_id, b.branch_name,
          COUNT(o.order_id)::int AS total_orders,
          COUNT(o.order_id) FILTER (WHERE o.status = 'delivered')::int AS delivered,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status != 'cancelled'), 0)::numeric AS revenue,
          COUNT(DISTINCT o.customer_id)::int AS unique_customers,
          ROUND(COUNT(o.order_id) FILTER (WHERE o.status = 'delivered')::numeric /
            NULLIF(COUNT(o.order_id) FILTER (WHERE o.status != 'cancelled'), 0) * 100, 1)::numeric AS delivery_rate
        FROM branches b LEFT JOIN orders o ON o.branch_id = b.branch_id
          AND o.scheduled_date >= CURRENT_DATE - ($1 || ' days')::interval
        GROUP BY b.branch_id, b.branch_name ORDER BY revenue DESC
      `;
      const rows = await this.db.query(sql, [days]);
      return { status: true, data: rows.map((r: any) => ({ ...r, revenue: Number(r.revenue), delivery_rate: Number(r.delivery_rate ?? 0) })), message: 'Branch performance fetched' };
    } catch (error) {
      this.developer.error('getBranchPerformance error', { error });
      throw new InternalServerErrorException('Failed');
    }
  }

  async getBranchProfitability(query: any) {
    return this.getBranchPerformance(query);
  }

  async getDeliveryEfficiency(query: any) {
    try {
      const days = parseInt(query.days || '30', 10);
      const sql = `
        SELECT
          COUNT(*)::int AS total_deliveries,
          COUNT(*) FILTER (WHERE status = 'delivered')::int AS successful,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
          ROUND(COUNT(*) FILTER (WHERE status = 'delivered')::numeric /
            NULLIF(COUNT(*) FILTER (WHERE status NOT IN ('cancelled')), 0) * 100, 1)::numeric AS success_rate,
          COUNT(DISTINCT delivery_partner_id)::int AS partners_active,
          ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT delivery_partner_id), 0), 1)::numeric AS avg_per_partner
        FROM orders
        WHERE scheduled_date >= CURRENT_DATE - ($1 || ' days')::interval
          AND delivery_partner_id IS NOT NULL
      `;
      const rows = await this.db.query(sql, [days]);
      return { status: true, data: rows[0] ?? {}, message: 'Delivery efficiency fetched' };
    } catch (error) {
      this.developer.error('getDeliveryEfficiency error', { error });
      throw new InternalServerErrorException('Failed');
    }
  }

  async getConsolidated(query: any) {
    try {
      const [revenue, wallet, growth, subGrowth, delivery] = await Promise.all([
        this.getRevenueReport({ ...query, days: '7' }),
        this.getWalletReport(query),
        this.getCustomerGrowth({ ...query, days: '7' }),
        this.getSubscriptionGrowth({ ...query, days: '7' }),
        this.getDeliveryEfficiency({ ...query, days: '7' }),
      ]);
      return { status: true, data: { revenue: revenue.data, wallet: wallet.data, customerGrowth: growth.data, subscriptionGrowth: subGrowth.data, delivery: delivery.data }, message: 'Consolidated data fetched' };
    } catch (error) {
      this.developer.error('getConsolidated error', { error });
      throw new InternalServerErrorException('Failed');
    }
  }

  // ── Revenue report exports ────────────────────────────────────────────────

  /** Quotes a value for CSV: doubles inner quotes, wraps when it must. */
  private csvCell(value: unknown): string {
    const s = value === null || value === undefined ? '' : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  private csvSection(title: string, headers: string[], rows: unknown[][]): string[] {
    return [
      title,
      headers.map((h) => this.csvCell(h)).join(','),
      ...rows.map((r) => r.map((c) => this.csvCell(c)).join(',')),
      '',
    ];
  }

  /**
   * One CSV carrying every section of the report, so a finance user opens a
   * single file rather than stitching six downloads together.
   */
  async exportRevenueCsv(query: any): Promise<string> {
    const { data } = (await this.getRevenuePaymentsReport(query)) as any;
    const money = (v: unknown) => Number(v ?? 0).toFixed(2);
    const pct = (v: unknown) => Number(v ?? 0).toFixed(1);
    const lines: string[] = [];

    lines.push(this.csvCell('Revenue & Payments Report'));
    lines.push(
      ['Period', `${data.range.from} to ${data.range.to}`].map((c) => this.csvCell(c)).join(','),
    );
    const activeFilters = Object.entries(data.filters ?? {})
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    lines.push(['Filters', activeFilters || 'none'].map((c) => this.csvCell(c)).join(','));
    lines.push('');

    lines.push(...this.csvSection('SUMMARY', ['Metric', 'Value'], [
      ['Gross revenue', money(data.totals.gross_revenue)],
      ['Collected', money(data.totals.collected)],
      ['Outstanding', money(data.totals.outstanding)],
      ['Collection rate %', pct(data.totals.collection_rate)],
      ['Discounts', money(data.totals.discounts)],
      ['Tax', money(data.totals.tax)],
      ['Orders', data.totals.orders],
      ['Paying customers', data.totals.customers],
      ['Average order value', money(data.totals.avg_order_value)],
      ['Subscription revenue', money(data.totals.subscription_revenue)],
      ['One-time revenue', money(data.totals.onetime_revenue)],
    ]));

    lines.push(...this.csvSection(
      'BRANCH WISE',
      ['Branch', 'Orders', 'Customers', 'Revenue', 'Collected', 'Outstanding', 'Subscription', 'One-time', 'Share %'],
      data.by_branch.map((r: any) => [
        r.branch_name, r.orders, r.customers, money(r.revenue), money(r.collected),
        money(r.outstanding), money(r.subscription_revenue), money(r.onetime_revenue), pct(r.share_pct),
      ]),
    ));

    lines.push(...this.csvSection(
      'PAYMENT TYPE WISE',
      ['Payment mode', 'Orders', 'Revenue', 'Collected', 'Outstanding', 'Share %'],
      data.by_payment_mode.map((r: any) => [
        r.payment_mode, r.orders, money(r.revenue), money(r.collected), money(r.outstanding), pct(r.share_pct),
      ]),
    ));

    lines.push(...this.csvSection(
      'SUBSCRIPTION VS ONE-TIME',
      ['Source', 'Orders', 'Customers', 'Revenue', 'Collected', 'Avg order value', 'Share %'],
      data.by_source.map((r: any) => [
        r.source, r.orders, r.customers, money(r.revenue), money(r.collected),
        money(r.avg_order_value), pct(r.share_pct),
      ]),
    ));

    lines.push(...this.csvSection(
      'BILLING BY PAYMENT TYPE',
      ['Payment type', 'Bill type', 'Bills', 'Billed', 'Paid', 'Due'],
      data.billing.by_payment_type.map((r: any) => [
        r.payment_type, r.bill_type, r.bills, money(r.billed), money(r.paid), money(r.due),
      ]),
    ));

    const c = data.billing.collection;
    lines.push(...this.csvSection('COLLECTION STATUS', ['Bucket', 'Bills', 'Amount'], [
      ['Settled', c.settled_bills, money(c.settled_amount)],
      ['Due (not yet overdue)', c.due_bills, money(c.due_amount)],
      ['Overdue', c.overdue_bills, money(c.overdue_amount)],
    ]));

    lines.push(...this.csvSection(
      'DAILY TREND',
      ['Date', 'Orders', 'Revenue', 'Collected', 'Subscription', 'One-time'],
      data.daily.map((r: any) => [
        r.day, r.orders, money(r.revenue), money(r.collected),
        money(r.subscription_revenue), money(r.onetime_revenue),
      ]),
    ));

    // BOM so Excel opens the ₹-free numeric CSV in the right encoding
    return '﻿' + lines.join('\r\n');
  }

  /** Branch-wise PDF with the headline numbers on top. */
  async exportRevenueReportPdf(query: any): Promise<Buffer> {
    const { data } = (await this.getRevenuePaymentsReport(query)) as any;
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    return this.pdfService.generateReport({
      title: 'Revenue & Payments Report',
      subtitle: `${data.range.from} to ${data.range.to}`,
      generatedAt: now,
      summaryCards: [
        { label: 'Gross Revenue', value: formatMoney(data.totals.gross_revenue), color: '#f0fdf4' },
        { label: 'Collected', value: formatMoney(data.totals.collected), color: '#eff6ff' },
        { label: 'Outstanding', value: formatMoney(data.totals.outstanding), color: '#fef2f2' },
        { label: 'Subscription', value: formatMoney(data.totals.subscription_revenue), color: '#faf5ff' },
        { label: 'One-time', value: formatMoney(data.totals.onetime_revenue), color: '#fefce8' },
      ],
      columns: [
        { header: 'Branch', key: 'branch_name', width: 130 },
        { header: 'Orders', key: 'orders', width: 55, align: 'right' },
        { header: 'Revenue', key: 'revenue', width: 90, align: 'right', format: (v) => formatMoney(v) },
        { header: 'Collected', key: 'collected', width: 90, align: 'right', format: (v) => formatMoney(v) },
        { header: 'Outstanding', key: 'outstanding', width: 90, align: 'right', format: (v) => formatMoney(v) },
        { header: 'Subscription', key: 'subscription_revenue', width: 90, align: 'right', format: (v) => formatMoney(v) },
        { header: 'One-time', key: 'onetime_revenue', width: 90, align: 'right', format: (v) => formatMoney(v) },
      ],
      rows: data.by_branch,
      footer: `Generated at ${now}`,
      orientation: 'landscape',
    });
  }

  async exportRevenuePdf(query: any): Promise<Buffer> {
    const report = await this.getRevenueReport(query);
    const rows = (report.data as any).daily || [];
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    return this.pdfService.generateReport({
      title: 'Revenue Report', subtitle: `Last ${query.days || 30} days`, generatedAt: now,
      summaryCards: [
        { label: 'Total Revenue', value: formatMoney((report.data as any).totals?.total_revenue), color: '#f0fdf4' },
        { label: 'Total Orders', value: (report.data as any).totals?.total_orders ?? 0, color: '#eff6ff' },
        { label: 'Total Discounts', value: formatMoney((report.data as any).totals?.total_discounts), color: '#fefce8' },
      ],
      columns: [
        { header: 'Date', key: 'day', width: 100 },
        { header: 'Orders', key: 'orders', width: 80, align: 'right' },
        { header: 'Revenue', key: 'revenue', width: 120, align: 'right', format: (v) => formatMoney(v) },
        { header: 'Discounts', key: 'discounts', width: 100, align: 'right', format: (v) => formatMoney(v) },
        { header: 'Subscription', key: 'sub_orders', width: 80, align: 'right' },
        { header: 'One-time', key: 'onetime_orders', width: 80, align: 'right' },
      ],
      rows, footer: `Generated at ${now}`, orientation: 'landscape',
    });
  }

  async exportSubscriptionPdf(query: any): Promise<Buffer> {
    const report = await this.getSubscriptionRevenue(query);
    const rows = report.data || [];
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    return this.pdfService.generateReport({
      title: 'Subscription Revenue Report', subtitle: `Last ${query.days || 30} days`, generatedAt: now,
      columns: [
        { header: 'Date', key: 'day', width: 120 },
        { header: 'Orders', key: 'orders', width: 100, align: 'right' },
        { header: 'Revenue', key: 'revenue', width: 150, align: 'right', format: (v) => formatMoney(v) },
      ],
      rows: rows as Record<string, unknown>[], footer: `Generated at ${now}`, orientation: 'portrait',
    });
  }
}
