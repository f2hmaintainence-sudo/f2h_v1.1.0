import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../../shared/database/Database.service';
import { DeveloperService } from '../../../shared/logger/Developer.service';
import { PdfService } from '../../../common/pdf/pdf.service';

function formatMoney(v: unknown): string {
  return '₹' + Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly pdfService: PdfService,
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
        c.first_name,
        c.last_name,
        c.phone,
        COALESCE(c.wallet_balance, 0)::numeric AS wallet_balance,
        (
          SELECT COALESCE(SUM(o.total_amount), 0)::numeric
          FROM orders o
          WHERE o.customer_id = c.customer_id
            AND o.payment_status = 'pending'
            AND o.status != 'cancelled'
        ) AS pending_amount
      FROM customers c
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
          FROM refunds WHERE created_at >= CURRENT_DATE - ($1 || ' days')::interval
          GROUP BY status, refund_type

          UNION ALL

          SELECT 'processed' AS status, 'wallet_deposit' AS refund_method,
            COUNT(*)::int AS count,
            COALESCE(SUM(refund_amount), 0)::numeric AS total_amount
          FROM subscription_refunds WHERE created_at >= CURRENT_DATE - ($1 || ' days')::interval
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
        WHERE created_at >= CURRENT_DATE - ($1 || ' days')::interval

        UNION ALL

        SELECT 
          sr.id::text AS id,
          sr.id::text AS refund_number,
          sr.customer_id,
          sr.subscription_id AS order_id,
          sr.refund_amount,
          'wallet_deposit' AS refund_type,
          COALESCE(sr.status, 'processed')::text AS status,
          ('Subscription pause refund for ' || sr.total_paused_days || ' days (' || sr.refund_month || ')') AS reason,
          sr.created_at,
          'subscription_pause_refund' AS category
        FROM subscription_refunds sr
        WHERE sr.created_at >= CURRENT_DATE - ($1 || ' days')::interval

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

        // Fetch customer balance
        const custRes = await this.db.query(
          `SELECT wallet_balance FROM customers WHERE customer_id = $1 LIMIT 1`,
          [sr.customer_id]
        );
        const currentBalance = Number(custRes?.[0]?.wallet_balance || 0);
        const newBalance = currentBalance + refundAmount;

        // Credit customer wallet balance
        await this.db.query(
          `UPDATE customers SET wallet_balance = $1, updated_at = NOW() WHERE customer_id = $2`,
          [newBalance, sr.customer_id]
        );

        // Insert wallet transaction
        const walletTxRes = await this.db.query(
          `INSERT INTO customer_wallet_transactions (customer_id, transaction_type, amount, balance_after, reference_type, reference_id, remarks, created_at)
           VALUES ($1, 'credit', $2, $3, 'subscription_pause_refund', $4, $5, NOW()) RETURNING id`,
          [sr.customer_id, refundAmount, newBalance, sr.subscription_id, `Refund for ${sr.total_paused_days} paused days in ${sr.refund_month}`]
        );

        const walletTxId = String(walletTxRes?.[0]?.id || '');

        // Update subscription_refunds record status to processed
        await this.db.query(
          `UPDATE subscription_refunds SET status = 'processed', wallet_transaction_id = $1 WHERE id = $2`,
          [walletTxId, refundId]
        );

        // Mark subscription_pauses as is_refunded = true
        await this.db.query(
          `UPDATE subscription_pauses SET is_refunded = true WHERE subscription_id = $1 AND is_refunded = false`,
          [sr.subscription_id]
        );

        return {
          status: true,
          message: `Refund ₹${refundAmount} processed and credited to customer wallet successfully.`,
          new_balance: newBalance
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

        // Fetch customer balance
        const custRes = await this.db.query(
          `SELECT wallet_balance FROM customers WHERE customer_id = $1 LIMIT 1`,
          [r.customer_id]
        );
        const currentBalance = Number(custRes?.[0]?.wallet_balance || 0);
        const newBalance = currentBalance + refundAmount;

        // Credit customer wallet balance
        await this.db.query(
          `UPDATE customers SET wallet_balance = $1, updated_at = NOW() WHERE customer_id = $2`,
          [newBalance, r.customer_id]
        );

        // Insert wallet transaction
        await this.db.query(
          `INSERT INTO customer_wallet_transactions (customer_id, transaction_type, amount, balance_after, reference_type, reference_id, remarks, created_at)
           VALUES ($1, 'credit', $2, $3, 'order_refund', $4, $5, NOW())`,
          [r.customer_id, refundAmount, newBalance, r.order_id || r.id, `Order refund ${r.refund_number || r.id}`]
        );

        // Update refunds table status
        await this.db.query(
          `UPDATE refunds SET status = 'processed' WHERE id = $1`,
          [r.id]
        );

        return {
          status: true,
          message: `Order refund ₹${refundAmount} processed and credited to customer wallet successfully.`,
          new_balance: newBalance
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
