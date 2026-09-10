import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/shared/database/Database.service';

@Injectable()
export class FinanceRepository {
  constructor(private readonly db: DatabaseService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── SUBSCRIBER OUTSTANDING BILLS & INSIGHTS ──────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  async getSubscriberOutstandingBills(query: any): Promise<{ bills: any[]; total: number }> {
    const conditions: string[] = [
      `pb.deleted_at IS NULL`,
      `pb.due_amount > 0`,
      `LOWER(pb.status::text) NOT IN ('paid', 'cancelled')`,
      `(pb.bill_type IN ('subscription', 'postpaid', 'subscriber') OR pb.payment_type = 'postpaid')`,
    ];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.status) {
      const st = String(query.status).toLowerCase();
      if (st === 'overdue') {
        conditions.push(`pb.due_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date`);
      } else if (st === 'unpaid' || st === 'pending') {
        conditions.push(`pb.due_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date`);
      } else if (st === 'partial') {
        conditions.push(`pb.paid_amount > 0`);
      }
    }

    if (query.search) {
      conditions.push(
        `(pb.bill_id ILIKE $${paramIndex} OR pb.customer_id ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex})`
      );
      params.push(`%${query.search.trim()}%`);
      paramIndex++;
    }

    if (query.branchId && query.branchId !== 'all') {
      conditions.push(`c.branch_id = $${paramIndex}`);
      params.push(query.branchId);
      paramIndex++;
    }

    if (query.startDate) {
      conditions.push(`pb.created_at >= $${paramIndex}::date`);
      params.push(query.startDate);
      paramIndex++;
    }

    if (query.endDate) {
      conditions.push(`pb.created_at <= $${paramIndex}::date + interval '1 day'`);
      params.push(query.endDate);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM public.customer_bills pb
      LEFT JOIN public.customers c ON (c.customer_id = pb.customer_id)
      LEFT JOIN public.users u ON (u.user_id = pb.customer_id)
      ${whereClause}
    `;
    const countRows = await this.db.query(countSql, params);
    const total = Number(countRows?.[0]?.total || 0);

    if (query.export === 'true' || query.export === true) {
      const dataSql = `
        SELECT 
          pb.bill_id AS id,
          pb.bill_id AS bill_number,
          pb.customer_id,
          pb.bill_type,
          pb.payment_method,
          pb.payment_type,
          pb.billing_from AS period_start,
          pb.billing_to AS period_end,
          pb.due_date,
          pb.total_amount,
          pb.paid_amount,
          pb.due_amount,
          pb.status,
          pb.created_at,
          COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), NULLIF(u.user_name, ''), NULLIF(u.email, ''), pb.customer_id) AS customer_name,
          COALESCE(u.phone, '') AS customer_phone,
          COALESCE(u.email, '') AS customer_email,
          COALESCE(b.branch_name, 'Main Hub') AS branch_name,
          b.branch_id,
          (
            SELECT COUNT(*)
            FROM public.customer_bill_items cbi
            WHERE cbi.bill_id = pb.bill_id
          ) AS order_count,
          GREATEST(0, (CURRENT_DATE - pb.due_date::date)) AS days_overdue
        FROM public.customer_bills pb
        LEFT JOIN public.customers c ON (c.customer_id = pb.customer_id)
        LEFT JOIN public.users u ON (u.user_id = pb.customer_id)
        LEFT JOIN public.branches b ON (b.branch_id = c.branch_id)
        ${whereClause}
        ORDER BY pb.due_date ASC, pb.created_at DESC
        LIMIT 5000
      `;
      const bills = await this.db.query(dataSql, params);
      return { bills: Array.isArray(bills) ? bills : [], total };
    }

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
    const offset = (page - 1) * limit;

    const dataSql = `
      SELECT 
        pb.bill_id AS id,
        pb.bill_id AS bill_number,
        pb.customer_id,
        pb.bill_type,
        pb.payment_method,
        pb.payment_type,
        pb.billing_from AS period_start,
        pb.billing_to AS period_end,
        pb.due_date,
        pb.total_amount,
        pb.paid_amount,
        pb.due_amount,
        pb.status,
        pb.created_at,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), NULLIF(u.user_name, ''), NULLIF(u.email, ''), pb.customer_id) AS customer_name,
        COALESCE(u.phone, '') AS customer_phone,
        COALESCE(u.email, '') AS customer_email,
        COALESCE(b.branch_name, 'Main Hub') AS branch_name,
        b.branch_id,
        (
          SELECT COUNT(*)
          FROM public.customer_bill_items cbi
          WHERE cbi.bill_id = pb.bill_id
        ) AS order_count,
        GREATEST(0, (CURRENT_DATE - pb.due_date::date)) AS days_overdue
      FROM public.customer_bills pb
      LEFT JOIN public.customers c ON (c.customer_id = pb.customer_id)
      LEFT JOIN public.users u ON (u.user_id = pb.customer_id)
      LEFT JOIN public.branches b ON (b.branch_id = c.branch_id)
      ${whereClause}
      ORDER BY pb.due_date ASC, pb.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const bills = await this.db.query(dataSql, [...params, limit, offset]);

    return { bills: Array.isArray(bills) ? bills : [], total };
  }

  async getSubscriberOutstandingsStats(): Promise<any> {
    const sqlStats = `
      SELECT 
        COALESCE(SUM(pb.due_amount), 0)::numeric AS total_outstanding,
        COUNT(*)::int AS total_bills,
        COALESCE(SUM(CASE WHEN pb.due_date < CURRENT_DATE THEN pb.due_amount ELSE 0 END), 0)::numeric AS overdue_amount,
        COUNT(CASE WHEN pb.due_date < CURRENT_DATE THEN 1 END)::int AS overdue_count,

        -- Aging Breakdown (due_amount)
        COALESCE(SUM(CASE WHEN (CURRENT_DATE - pb.due_date::date) <= 7 THEN pb.due_amount ELSE 0 END), 0)::numeric AS aging_0_7_amount,
        COUNT(CASE WHEN (CURRENT_DATE - pb.due_date::date) <= 7 THEN 1 END)::int AS aging_0_7_count,

        COALESCE(SUM(CASE WHEN (CURRENT_DATE - pb.due_date::date) BETWEEN 8 AND 15 THEN pb.due_amount ELSE 0 END), 0)::numeric AS aging_8_15_amount,
        COUNT(CASE WHEN (CURRENT_DATE - pb.due_date::date) BETWEEN 8 AND 15 THEN 1 END)::int AS aging_8_15_count,

        COALESCE(SUM(CASE WHEN (CURRENT_DATE - pb.due_date::date) BETWEEN 16 AND 30 THEN pb.due_amount ELSE 0 END), 0)::numeric AS aging_16_30_amount,
        COUNT(CASE WHEN (CURRENT_DATE - pb.due_date::date) BETWEEN 16 AND 30 THEN 1 END)::int AS aging_16_30_count,

        COALESCE(SUM(CASE WHEN (CURRENT_DATE - pb.due_date::date) > 30 THEN pb.due_amount ELSE 0 END), 0)::numeric AS aging_30_plus_amount,
        COUNT(CASE WHEN (CURRENT_DATE - pb.due_date::date) > 30 THEN 1 END)::int AS aging_30_plus_count
      FROM public.customer_bills pb
      WHERE pb.deleted_at IS NULL
        AND (pb.bill_type IN ('subscription', 'postpaid', 'subscriber') OR pb.payment_type = 'postpaid')
        AND pb.due_amount > 0
        AND LOWER(pb.status::text) NOT IN ('paid', 'cancelled')
    `;
    const rows = await this.db.query(sqlStats, []);
    const summary = rows?.[0] || {};

    // Top 5 Debtor Subscribers
    const sqlTopDebtors = `
      SELECT 
        pb.customer_id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), NULLIF(u.user_name, ''), NULLIF(u.email, ''), pb.customer_id) AS customer_name,
        COALESCE(u.phone, '') AS customer_phone,
        COALESCE(b.branch_name, 'Main Hub') AS branch_name,
        COUNT(pb.bill_id)::int AS bill_count,
        SUM(pb.due_amount)::numeric AS total_due
      FROM public.customer_bills pb
      LEFT JOIN public.customers c ON (c.customer_id = pb.customer_id)
      LEFT JOIN public.users u ON (u.user_id = pb.customer_id)
      LEFT JOIN public.branches b ON (b.branch_id = c.branch_id)
      WHERE pb.deleted_at IS NULL
        AND (pb.bill_type IN ('subscription', 'postpaid', 'subscriber') OR pb.payment_type = 'postpaid')
        AND pb.due_amount > 0
        AND LOWER(pb.status::text) NOT IN ('paid', 'cancelled')
      GROUP BY pb.customer_id, u.first_name, u.last_name, u.user_name, u.email, u.phone, b.branch_name
      ORDER BY total_due DESC
      LIMIT 5
    `;
    const topDebtorsRes = await this.db.query(sqlTopDebtors, []);
    const topDebtors = Array.isArray(topDebtorsRes) ? topDebtorsRes : [];

    // Branch-wise Dues Breakdown
    const sqlBranchDues = `
      SELECT 
        COALESCE(b.branch_name, 'Unassigned') AS branch_name,
        COALESCE(b.branch_id, 'none') AS branch_id,
        COUNT(pb.bill_id)::int AS bill_count,
        SUM(pb.due_amount)::numeric AS total_due
      FROM public.customer_bills pb
      LEFT JOIN public.customers c ON (c.customer_id = pb.customer_id)
      LEFT JOIN public.users u ON (u.user_id = pb.customer_id)
      LEFT JOIN public.branches b ON (b.branch_id = c.branch_id)
      WHERE pb.deleted_at IS NULL
        AND (pb.bill_type IN ('subscription', 'postpaid', 'subscriber') OR pb.payment_type = 'postpaid')
        AND pb.due_amount > 0
        AND LOWER(pb.status::text) NOT IN ('paid', 'cancelled')
      GROUP BY b.branch_name, b.branch_id
      ORDER BY total_due DESC
    `;
    const branchDuesRes = await this.db.query(sqlBranchDues, []);
    const branchDues = Array.isArray(branchDuesRes) ? branchDuesRes : [];

    return {
      summary,
      topDebtors,
      branchDues,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── ALL CUSTOMER BILLING (CUSTOMER_BILLS TABLE: WALLET, COD, UPI, ETC.) ──
  // ═══════════════════════════════════════════════════════════════════════════

  async getAllCustomerBills(query: any): Promise<{ bills: any[]; total: number }> {
    const conditions: string[] = [`pb.deleted_at IS NULL`];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.type && query.type !== 'all') {
      const t = String(query.type).toLowerCase();
      if (t === 'subscription_postpaid' || t === 'postpaid') {
        conditions.push(`(pb.bill_type IN ('subscription', 'postpaid') OR pb.payment_type = 'postpaid') AND pb.payment_type = 'postpaid'`);
      } else if (t === 'subscription_prepaid') {
        conditions.push(`pb.bill_type = 'subscription' AND pb.payment_type = 'prepaid'`);
      } else if (t === 'subscription') {
        conditions.push(`(pb.bill_type IN ('subscription', 'postpaid') OR pb.payment_type = 'postpaid')`);
      } else if (t === 'order' || t === 'prepaid' || t === 'one-time' || t === 'one_time') {
        conditions.push(`((pb.bill_type IN ('order', 'prepaid') OR pb.payment_type = 'prepaid') AND pb.bill_type NOT IN ('subscription', 'postpaid'))`);
      }
    }

    if (query.payment_method && query.payment_method !== 'all') {
      conditions.push(`LOWER(pb.payment_method::text) = $${paramIndex++}`);
      params.push(String(query.payment_method).toLowerCase());
    } else if (query.method && query.method !== 'all') {
      conditions.push(`LOWER(pb.payment_method::text) = $${paramIndex++}`);
      params.push(String(query.method).toLowerCase());
    }

    if (query.payment_type && query.payment_type !== 'all') {
      conditions.push(`LOWER(pb.payment_type::text) = $${paramIndex++}`);
      params.push(String(query.payment_type).toLowerCase());
    }

    if (query.status && query.status !== 'all') {
      conditions.push(`LOWER(pb.status::text) = $${paramIndex++}`);
      params.push(String(query.status).toLowerCase());
    }

    if (query.branchId && query.branchId !== 'all') {
      conditions.push(`c.branch_id = $${paramIndex++}`);
      params.push(String(query.branchId));
    } else if (query.branch_id && query.branch_id !== 'all') {
      conditions.push(`c.branch_id = $${paramIndex++}`);
      params.push(String(query.branch_id));
    }

    if (query.startDate || query.from_date) {
      const sDate = query.startDate || query.from_date;
      conditions.push(`pb.created_at >= $${paramIndex++}::date`);
      params.push(sDate);
    }

    if (query.endDate || query.to_date) {
      const eDate = query.endDate || query.to_date;
      conditions.push(`pb.created_at <= $${paramIndex++}::date + interval '1 day'`);
      params.push(eDate);
    }

    if (query.search) {
      conditions.push(
        `(pb.bill_id ILIKE $${paramIndex} OR pb.customer_id ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`
      );
      params.push(`%${query.search.trim()}%`);
      paramIndex++;
    }

    if (query.days && !query.startDate && !query.from_date) {
      const daysNum = Math.max(1, Number(query.days || 30));
      conditions.push(`pb.created_at >= (CURRENT_DATE - ($${paramIndex++} || ' days')::interval)`);
      params.push(daysNum);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM public.customer_bills pb
      LEFT JOIN public.customers c ON (c.customer_id = pb.customer_id)
      LEFT JOIN public.users u ON (u.user_id = pb.customer_id)
      ${whereClause}
    `;
    const countRows = await this.db.query(countSql, params);
    const total = Number(countRows?.[0]?.total || 0);

    if (query.export === 'true' || query.export === true) {
      const dataSql = `
        SELECT 
          pb.bill_id AS id,
          pb.bill_id AS bill_number,
          pb.customer_id,
          pb.bill_type,
          pb.payment_method,
          pb.payment_type,
          pb.billing_from AS period_start,
          pb.billing_to AS period_end,
          pb.due_date,
          pb.subtotal,
          pb.tax_amount,
          pb.discount_amount,
          pb.total_amount,
          pb.paid_amount,
          pb.due_amount,
          pb.status,
          pb.created_at,
          pb.updated_at,
          COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), NULLIF(u.user_name, ''), NULLIF(u.email, ''), pb.customer_id) AS customer_name,
          COALESCE(u.phone, '') AS customer_phone,
          COALESCE(u.email, '') AS customer_email,
          COALESCE(b.branch_name, 'Main Hub') AS branch_name,
          b.branch_id,
          (
            SELECT COUNT(*)
            FROM public.customer_bill_items cbi
            WHERE cbi.bill_id = pb.bill_id
          ) AS order_count
        FROM public.customer_bills pb
        LEFT JOIN public.customers c ON (c.customer_id = pb.customer_id)
        LEFT JOIN public.users u ON (u.user_id = pb.customer_id)
        LEFT JOIN public.branches b ON (b.branch_id = c.branch_id)
        ${whereClause}
        ORDER BY pb.created_at DESC
        LIMIT 5000
      `;
      const bills = await this.db.query(dataSql, params);
      return { bills: Array.isArray(bills) ? bills : [], total };
    }

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
    const offset = (page - 1) * limit;

    const dataSql = `
      SELECT 
        pb.bill_id AS id,
        pb.bill_id AS bill_number,
        pb.customer_id,
        pb.bill_type,
        pb.payment_method,
        pb.payment_type,
        pb.billing_from AS period_start,
        pb.billing_to AS period_end,
        pb.due_date,
        pb.subtotal,
        pb.tax_amount,
        pb.discount_amount,
        pb.total_amount,
        pb.paid_amount,
        pb.due_amount,
        pb.status,
        pb.created_at,
        pb.updated_at,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), NULLIF(u.user_name, ''), NULLIF(u.email, ''), pb.customer_id) AS customer_name,
        COALESCE(u.phone, '') AS customer_phone,
        COALESCE(u.email, '') AS customer_email,
        COALESCE(b.branch_name, 'Main Hub') AS branch_name,
        b.branch_id,
        (
          SELECT COUNT(*)
          FROM public.customer_bill_items cbi
          WHERE cbi.bill_id = pb.bill_id
        ) AS order_count,
        GREATEST(0, (CURRENT_DATE - pb.due_date::date)) AS days_overdue
      FROM public.customer_bills pb
      LEFT JOIN public.customers c ON (c.customer_id = pb.customer_id)
      LEFT JOIN public.users u ON (u.user_id = pb.customer_id)
      LEFT JOIN public.branches b ON (b.branch_id = c.branch_id)
      ${whereClause}
      ORDER BY pb.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const bills = await this.db.query(dataSql, [...params, limit, offset]);

    return { bills: Array.isArray(bills) ? bills : [], total };
  }

  async getBillingStats(days?: number): Promise<any> {
    const dateClause = days && Number(days) > 0 ? `AND pb.created_at >= (CURRENT_DATE - (${Number(days)} || ' days')::interval)` : '';

    const sqlGeneral = `
      SELECT 
        COALESCE(SUM(pb.total_amount), 0)::numeric AS total_invoiced,
        COALESCE(SUM(pb.paid_amount), 0)::numeric AS total_collected,
        COALESCE(SUM(pb.due_amount), 0)::numeric AS total_due,
        COUNT(*)::int AS total_bills,

        COALESCE(SUM(CASE WHEN pb.bill_type IN ('subscription', 'postpaid') OR pb.payment_type = 'postpaid' THEN pb.total_amount ELSE 0 END), 0)::numeric AS subscription_invoiced,
        COALESCE(SUM(CASE WHEN pb.bill_type IN ('subscription', 'postpaid') OR pb.payment_type = 'postpaid' THEN pb.paid_amount ELSE 0 END), 0)::numeric AS subscription_paid,
        COUNT(CASE WHEN pb.bill_type IN ('subscription', 'postpaid') OR pb.payment_type = 'postpaid' THEN 1 END)::int AS subscription_count,

        COALESCE(SUM(CASE WHEN (pb.bill_type IN ('order', 'prepaid') OR pb.payment_type = 'prepaid') AND pb.bill_type NOT IN ('subscription', 'postpaid') THEN pb.total_amount ELSE 0 END), 0)::numeric AS order_invoiced,
        COALESCE(SUM(CASE WHEN (pb.bill_type IN ('order', 'prepaid') OR pb.payment_type = 'prepaid') AND pb.bill_type NOT IN ('subscription', 'postpaid') THEN pb.paid_amount ELSE 0 END), 0)::numeric AS order_paid,
        COUNT(CASE WHEN (pb.bill_type IN ('order', 'prepaid') OR pb.payment_type = 'prepaid') AND pb.bill_type NOT IN ('subscription', 'postpaid') THEN 1 END)::int AS order_count,

        COUNT(CASE WHEN LOWER(pb.status::text) = 'paid' THEN 1 END)::int AS paid_count,
        COUNT(CASE WHEN LOWER(pb.status::text) IN ('pending', 'unpaid') THEN 1 END)::int AS pending_count,
        COUNT(CASE WHEN LOWER(pb.status::text) = 'partial' THEN 1 END)::int AS partial_count,
        COUNT(CASE WHEN LOWER(pb.status::text) = 'failed' THEN 1 END)::int AS failed_count,

        COALESCE(SUM(CASE WHEN LOWER(pb.payment_method) = 'wallet' THEN pb.paid_amount ELSE 0 END), 0)::numeric AS wallet_collected,
        COALESCE(SUM(CASE WHEN LOWER(pb.payment_method) = 'upi' THEN pb.paid_amount ELSE 0 END), 0)::numeric AS upi_collected,
        COALESCE(SUM(CASE WHEN LOWER(pb.payment_method) = 'razorpay' OR LOWER(pb.payment_method) = 'online' THEN pb.paid_amount ELSE 0 END), 0)::numeric AS razorpay_collected,
        COALESCE(SUM(CASE WHEN LOWER(pb.payment_method) = 'cash' OR LOWER(pb.payment_method) = 'cod' THEN pb.paid_amount ELSE 0 END), 0)::numeric AS cash_collected
      FROM public.customer_bills pb
      WHERE pb.deleted_at IS NULL
        ${dateClause}
    `;
    const rows = await this.db.query(sqlGeneral, []);
    const general = rows?.[0] || {};

    const sqlMethods = `
      SELECT 
        COALESCE(NULLIF(LOWER(pb.payment_method), ''), 'other') AS payment_method,
        COUNT(*)::int AS count,
        COALESCE(SUM(pb.paid_amount), 0)::numeric AS paid_amount,
        COALESCE(SUM(pb.total_amount), 0)::numeric AS total_amount
      FROM public.customer_bills pb
      WHERE pb.deleted_at IS NULL
        ${dateClause}
      GROUP BY COALESCE(NULLIF(LOWER(pb.payment_method), ''), 'other')
      ORDER BY paid_amount DESC
    `;
    const methodsRes = await this.db.query(sqlMethods, []);
    const methods = Array.isArray(methodsRes) ? methodsRes : [];

    const daysNum = days && Number(days) > 0 ? Number(days) : 30;
    const sqlDaily = `
      SELECT 
        TO_CHAR((pb.created_at AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS bill_date,
        COALESCE(NULLIF(LOWER(pb.payment_method), ''), 'wallet') AS payment_method,
        COUNT(*)::int AS count,
        COALESCE(SUM(pb.paid_amount), 0)::numeric AS paid_amount,
        COALESCE(SUM(pb.total_amount), 0)::numeric AS total_amount
      FROM public.customer_bills pb
      WHERE pb.deleted_at IS NULL
        AND pb.created_at >= (CURRENT_DATE - (${daysNum} || ' days')::interval)
      GROUP BY (pb.created_at AT TIME ZONE 'Asia/Kolkata')::date, COALESCE(NULLIF(LOWER(pb.payment_method), ''), 'wallet')
      ORDER BY bill_date ASC
    `;
    const dailyRaw = await this.db.query(sqlDaily, []).catch(() => []);
    const dailyRows = Array.isArray(dailyRaw) ? dailyRaw : [];

    const dateMap = new Map<string, any>();
    const today = new Date();
    for (let i = daysNum - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const displayDate = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      dateMap.set(iso, {
        date: iso,
        displayDate,
        total: 0,
        upi: 0,
        razorpay: 0,
        card: 0,
        wallet: 0,
        cash: 0,
      });
    }

    for (const r of dailyRows) {
      const item = dateMap.get(r.bill_date);
      if (!item) continue;
      const amt = Number(r.paid_amount || r.total_amount || 0);
      item.total += amt;
      const meth = String(r.payment_method || '').toLowerCase();
      if (meth.includes('upi')) item.upi += amt;
      else if (meth.includes('razorpay') || meth.includes('online') || meth.includes('gateway')) item.razorpay += amt;
      else if (meth.includes('card')) item.card += amt;
      else if (meth.includes('wallet')) item.wallet += amt;
      else if (meth.includes('cash') || meth.includes('cod')) item.cash += amt;
      else item.wallet += amt;
    }

    return {
      general,
      methods,
      dailyTrend: Array.from(dateMap.values()),
      days: daysNum,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── ONLINE PAYMENT TRANSACTIONS (PAYMENT_TRANSACTIONS TABLE: RAZORPAY) ───
  // ═══════════════════════════════════════════════════════════════════════════

  async getOnlinePaymentTransactions(query: any): Promise<{ data: any[]; total: number }> {
    const conditions: string[] = [`pt.deleted_at IS NULL`];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.status && query.status !== 'all') {
      conditions.push(`LOWER(pt.status::text) = $${paramIndex++}`);
      params.push(String(query.status).toLowerCase());
    }

    if (query.purpose && query.purpose !== 'all') {
      conditions.push(`LOWER(pt.purpose::text) = $${paramIndex++}`);
      params.push(String(query.purpose).toLowerCase());
    }

    if (query.method && query.method !== 'all') {
      conditions.push(`LOWER(pt.method::text) = $${paramIndex++}`);
      params.push(String(query.method).toLowerCase());
    }

    if (query.provider && query.provider !== 'all') {
      conditions.push(`LOWER(pt.provider::text) = $${paramIndex++}`);
      params.push(String(query.provider).toLowerCase());
    }

    if (query.startDate || query.from_date) {
      const sDate = query.startDate || query.from_date;
      conditions.push(`pt.created_at >= $${paramIndex++}::date`);
      params.push(sDate);
    }

    if (query.endDate || query.to_date) {
      const eDate = query.endDate || query.to_date;
      conditions.push(`pt.created_at <= $${paramIndex++}::date + interval '1 day'`);
      params.push(eDate);
    }

    if (query.search) {
      conditions.push(
        `(pt.transaction_id ILIKE $${paramIndex} OR pt.provider_order_id ILIKE $${paramIndex} OR pt.provider_payment_id ILIKE $${paramIndex} OR pt.customer_id ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`
      );
      params.push(`%${query.search.trim()}%`);
      paramIndex++;
    }

    if (query.days && !query.startDate && !query.from_date) {
      const daysNum = Math.max(1, Number(query.days || 30));
      conditions.push(`pt.created_at >= (CURRENT_DATE - ($${paramIndex++} || ' days')::interval)`);
      params.push(daysNum);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM public.payment_transactions pt
      LEFT JOIN public.users u ON (u.user_id = pt.customer_id)
      ${whereClause}
    `;
    const countRows = await this.db.query(countSql, params);
    const total = Number(countRows?.[0]?.total || 0);

    if (query.export === 'true' || query.export === true) {
      const dataSql = `
        SELECT 
          pt.id,
          pt.transaction_id,
          pt.customer_id,
          pt.purpose,
          pt.reference_id,
          pt.provider,
          pt.provider_order_id,
          pt.provider_payment_id,
          pt.method,
          pt.amount,
          pt.currency,
          pt.status,
          pt.failure_reason,
          pt.notes,
          pt.paid_at,
          pt.fulfilled_at,
          pt.refunded_amount,
          pt.created_at,
          COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), NULLIF(u.user_name, ''), NULLIF(u.email, ''), pt.customer_id) AS customer_name,
          COALESCE(u.phone, '') AS customer_phone,
          COALESCE(u.email, '') AS customer_email,
          COALESCE(b.branch_name, 'Main Hub') AS branch_name
        FROM public.payment_transactions pt
        LEFT JOIN public.customers c ON (c.customer_id = pt.customer_id)
        LEFT JOIN public.users u ON (u.user_id = pt.customer_id)
        LEFT JOIN public.branches b ON (b.branch_id = c.branch_id)
        ${whereClause}
        ORDER BY pt.created_at DESC
        LIMIT 5000
      `;
      const data = await this.db.query(dataSql, params);
      return { data: Array.isArray(data) ? data : [], total };
    }

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
    const offset = (page - 1) * limit;

    const dataSql = `
      SELECT 
        pt.id,
        pt.transaction_id,
        pt.customer_id,
        pt.purpose,
        pt.reference_id,
        pt.provider,
        pt.provider_order_id,
        pt.provider_payment_id,
        pt.method,
        pt.amount,
        pt.currency,
        pt.status,
        pt.failure_reason,
        pt.notes,
        pt.paid_at,
        pt.fulfilled_at,
        pt.refunded_amount,
        pt.created_at,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), NULLIF(u.user_name, ''), NULLIF(u.email, ''), pt.customer_id) AS customer_name,
        COALESCE(u.phone, '') AS customer_phone,
        COALESCE(u.email, '') AS customer_email,
        COALESCE(b.branch_name, 'Main Hub') AS branch_name
      FROM public.payment_transactions pt
      LEFT JOIN public.customers c ON (c.customer_id = pt.customer_id)
      LEFT JOIN public.users u ON (u.user_id = pt.customer_id)
      LEFT JOIN public.branches b ON (b.branch_id = c.branch_id)
      ${whereClause}
      ORDER BY pt.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const data = await this.db.query(dataSql, [...params, limit, offset]);

    return { data: Array.isArray(data) ? data : [], total };
  }

  async getPaymentsStats(days = 30): Promise<any> {
    const daysNum = Math.max(1, Number(days));

    // Telemetry from payment_transactions (Razorpay gateway)
    const sqlGeneral = `
      SELECT 
        COALESCE(SUM(CASE WHEN LOWER(pt.status::text) IN ('paid', 'fulfilled') THEN pt.amount ELSE 0 END), 0)::numeric AS total_collected,
        COALESCE(SUM(pt.amount), 0)::numeric AS total_volume,
        COALESCE(SUM(pt.refunded_amount), 0)::numeric AS total_refunded,
        COUNT(*)::int AS total_transactions,

        COUNT(CASE WHEN LOWER(pt.status::text) IN ('paid', 'fulfilled') THEN 1 END)::int AS paid_count,
        COUNT(CASE WHEN LOWER(pt.status::text) = 'created' THEN 1 END)::int AS created_count,
        COUNT(CASE WHEN LOWER(pt.status::text) = 'failed' THEN 1 END)::int AS failed_count,
        COUNT(CASE WHEN LOWER(pt.status::text) = 'refunded' OR pt.refunded_amount > 0 THEN 1 END)::int AS refunded_count,

        COALESCE(SUM(CASE WHEN LOWER(pt.purpose::text) = 'wallet_topup' AND LOWER(pt.status::text) IN ('paid', 'fulfilled') THEN pt.amount ELSE 0 END), 0)::numeric AS wallet_topup_volume,
        COUNT(CASE WHEN LOWER(pt.purpose::text) = 'wallet_topup' THEN 1 END)::int AS wallet_topup_count,

        COALESCE(SUM(CASE WHEN LOWER(pt.purpose::text) = 'order' AND LOWER(pt.status::text) IN ('paid', 'fulfilled') THEN pt.amount ELSE 0 END), 0)::numeric AS order_volume,
        COUNT(CASE WHEN LOWER(pt.purpose::text) = 'order' THEN 1 END)::int AS order_count,

        COALESCE(SUM(CASE WHEN LOWER(pt.purpose::text) = 'subscription' AND LOWER(pt.status::text) IN ('paid', 'fulfilled') THEN pt.amount ELSE 0 END), 0)::numeric AS subscription_volume,
        COUNT(CASE WHEN LOWER(pt.purpose::text) = 'subscription' THEN 1 END)::int AS subscription_count,

        COALESCE(SUM(CASE WHEN LOWER(pt.purpose::text) = 'bill' AND LOWER(pt.status::text) IN ('paid', 'fulfilled') THEN pt.amount ELSE 0 END), 0)::numeric AS bill_volume,
        COUNT(CASE WHEN LOWER(pt.purpose::text) = 'bill' THEN 1 END)::int AS bill_count
      FROM public.payment_transactions pt
      WHERE pt.deleted_at IS NULL
        AND pt.created_at >= (CURRENT_DATE - (${daysNum} || ' days')::interval)
    `;
    const rowsGeneral = await this.db.query(sqlGeneral, []);
    const general = rowsGeneral?.[0] || {};
    const totalCollected = Number(general.total_collected || 0);
    const totalTransactions = Number(general.total_transactions || 0);
    const paidCount = Number(general.paid_count || 0);

    const successRate = totalTransactions > 0 ? Number(((paidCount / totalTransactions) * 100).toFixed(1)) : 100;
    const avgTransactionValue = paidCount > 0 ? Number((totalCollected / paidCount).toFixed(2)) : 0;

    const sqlMethods = `
      SELECT 
        COALESCE(NULLIF(LOWER(pt.method), ''), 'razorpay') AS payment_method,
        COUNT(*)::int AS count,
        COALESCE(SUM(CASE WHEN LOWER(pt.status::text) IN ('paid', 'fulfilled') THEN pt.amount ELSE 0 END), 0)::numeric AS paid_amount,
        COALESCE(SUM(pt.amount), 0)::numeric AS total_amount
      FROM public.payment_transactions pt
      WHERE pt.deleted_at IS NULL
        AND pt.created_at >= (CURRENT_DATE - (${daysNum} || ' days')::interval)
      GROUP BY COALESCE(NULLIF(LOWER(pt.method), ''), 'razorpay')
      ORDER BY paid_amount DESC
    `;
    const methodsResult = await this.db.query(sqlMethods, []);
    const rawMethods = Array.isArray(methodsResult) ? methodsResult : [];

    const methods = rawMethods.map((m: any) => {
      const pAmt = Number(m.paid_amount || 0);
      const percentage = totalCollected > 0 ? Number(((pAmt / totalCollected) * 100).toFixed(1)) : 0;
      const count = Number(m.count || 0);
      const avg = count > 0 ? Number((pAmt / count).toFixed(2)) : 0;
      return {
        ...m,
        percentage,
        average_amount: avg,
      };
    });

    // Daily payment trend specifically from payment_transactions (Razorpay)
    const sqlDaily = `
      SELECT 
        TO_CHAR((pt.created_at AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS payment_date,
        COALESCE(NULLIF(LOWER(pt.method), ''), 'razorpay') AS payment_method,
        COUNT(*)::int AS count,
        COALESCE(SUM(CASE WHEN LOWER(pt.status::text) IN ('paid', 'fulfilled') THEN pt.amount ELSE 0 END), 0)::numeric AS paid_amount,
        COALESCE(SUM(pt.amount), 0)::numeric AS total_amount
      FROM public.payment_transactions pt
      WHERE pt.deleted_at IS NULL
        AND pt.created_at >= (CURRENT_DATE - (${daysNum} || ' days')::interval)
      GROUP BY (pt.created_at AT TIME ZONE 'Asia/Kolkata')::date, COALESCE(NULLIF(LOWER(pt.method), ''), 'razorpay')
      ORDER BY payment_date ASC
    `;
    const dailyRaw = await this.db.query(sqlDaily, []);
    const dailyRows = Array.isArray(dailyRaw) ? dailyRaw : [];

    // Map into continuous date-keyed dictionary
    const dateMap = new Map<string, any>();
    const today = new Date();
    for (let i = daysNum - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const displayDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      dateMap.set(dateKey, {
        date: dateKey,
        displayDate,
        total: 0,
        upi: 0,
        razorpay: 0,
        wallet: 0,
        card: 0,
        netbanking: 0,
        other: 0,
        count: 0,
      });
    }

    for (const row of dailyRows) {
      const dKey = row.payment_date;
      if (!dateMap.has(dKey)) {
        const dObj = new Date(dKey);
        dateMap.set(dKey, {
          date: dKey,
          displayDate: !isNaN(dObj.getTime()) ? dObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : dKey,
          total: 0,
          upi: 0,
          razorpay: 0,
          wallet: 0,
          card: 0,
          netbanking: 0,
          other: 0,
          count: 0,
        });
      }
      const entry = dateMap.get(dKey);
      const amt = Number(row.paid_amount || 0);
      const cnt = Number(row.count || 0);
      entry.total += amt;
      entry.count += cnt;

      const method = String(row.payment_method || '').toLowerCase();
      if (method.includes('upi')) {
        entry.upi += amt;
      } else if (method.includes('card')) {
        entry.card += amt;
      } else if (method.includes('netbanking')) {
        entry.netbanking += amt;
      } else if (method.includes('wallet')) {
        entry.wallet += amt;
      } else if (method.includes('razorpay') || method === 'online') {
        entry.razorpay += amt;
      } else {
        entry.other += amt;
      }
    }

    const dailyTrend = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
      general: {
        ...general,
        success_rate: successRate,
        avg_transaction_value: avgTransactionValue,
      },
      methods,
      dailyTrend,
      days: daysNum,
    };
  }

  // Fallback combined report for general queries
  async getCombinedPaymentsReport(query: any): Promise<{ data: any[]; total: number }> {
    return await this.getOnlinePaymentTransactions(query);
  }

  async findBillById(id: string): Promise<any> {
    const sql = `
      SELECT 
        pb.bill_id AS id,
        pb.bill_id AS bill_number,
        pb.customer_id,
        pb.billing_from AS period_start,
        pb.billing_to AS period_end,
        pb.due_date,
        pb.total_amount,
        pb.paid_amount,
        pb.due_amount,
        pb.status,
        pb.created_at,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), NULLIF(u.user_name, ''), NULLIF(u.email, ''), pb.customer_id) AS customer_name,
        COALESCE(u.phone, '') AS customer_phone
      FROM public.customer_bills pb
      LEFT JOIN public.customers c ON (c.customer_id = pb.customer_id)
      LEFT JOIN public.users u ON (u.user_id = pb.customer_id)
      WHERE pb.bill_id = $1::varchar
      LIMIT 1
    `;
    const rows = await this.db.query(sql, [id]);
    return rows?.[0] ?? null;
  }

  async findBillsByIds(ids: string[]): Promise<any[]> {
    if (!ids || ids.length === 0) return [];
    const cleanIds = ids.map(id => String(id || '').replace(/^[#\s]+|[#\s]+$/g, '').trim()).filter(Boolean);
    const sql = `
      SELECT 
        pb.bill_id AS id,
        pb.bill_id AS bill_number,
        pb.customer_id,
        pb.billing_from AS period_start,
        pb.billing_to AS period_end,
        pb.due_date,
        pb.total_amount,
        pb.paid_amount,
        pb.due_amount,
        pb.status,
        pb.created_at,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), NULLIF(u.user_name, ''), NULLIF(u.email, ''), pb.customer_id) AS customer_name,
        COALESCE(u.phone, '') AS customer_phone
      FROM public.customer_bills pb
      LEFT JOIN public.customers c ON (c.customer_id = pb.customer_id)
      LEFT JOIN public.users u ON (u.user_id = pb.customer_id)
      WHERE pb.bill_id = ANY($1::varchar[])
         OR pb.bill_id = ANY($2::varchar[])
         OR pb.id::text = ANY($1::varchar[])
    `;
    const rows = await this.db.query(sql, [cleanIds, ids]);
    return Array.isArray(rows) ? rows : [];
  }

  async updateBillPayment(id: string, paidAmount: number, status: string): Promise<any> {
    const sql = `
      UPDATE public.customer_bills
      SET paid_amount = $2, 
          due_amount = GREATEST(0, total_amount - $2),
          status = $3, 
          updated_at = NOW()
      WHERE bill_id = $1::varchar
      RETURNING bill_id AS id, bill_id AS bill_number, total_amount, status
    `;
    const rows = await this.db.query(sql, [id, paidAmount, status]);
    return rows?.[0] ?? null;
  }

  async getBillReceipt(billId: string): Promise<any> {
    const cleanId = String(billId || '').trim();
    const strippedId = cleanId.replace(/^BILL_/, '');

    // 1. Direct query on customer_bills
    const baseRows = await this.db.query(
      `SELECT * FROM public.customer_bills 
       WHERE bill_id = $1::varchar OR bill_id = $2::varchar 
          OR reference_id = $1::varchar OR reference_id = $2::varchar 
       LIMIT 1`,
      [cleanId, strippedId],
    ).catch(() => []);

    let rawBill = baseRows?.[0];

    // If not in customer_bills, check if it's an order
    if (!rawBill) {
      const orderRows = await this.db.query(
        `SELECT o.order_id, o.customer_id, o.order_source, o.payment_status, o.payment_mode,
                o.subtotal, o.discount_amount, o.gst_amount, o.total_amount,
                o.scheduled_date, o.created_at, o.delivery_slot, o.address_line, o.contact_number, o.customer_name
         FROM public.orders o
         WHERE o.order_id = $1::varchar OR o.order_id = $2::varchar
         LIMIT 1`,
        [cleanId, strippedId],
      ).catch(() => []);

      if (orderRows?.[0]) {
        const ord = orderRows[0];
        const isPaid = (ord.payment_status || '').toLowerCase() === 'paid';
        const total = Number(ord.total_amount || 0);
        rawBill = {
          bill_id: `BILL_${ord.order_id}`,
          reference_id: ord.order_id,
          customer_id: ord.customer_id,
          bill_type: ord.order_source || 'subscription',
          payment_type: 'prepaid',
          payment_method: ord.payment_mode || 'wallet',
          billing_from: ord.scheduled_date || ord.created_at,
          billing_to: ord.scheduled_date || ord.created_at,
          due_date: ord.created_at,
          subtotal: Number(ord.subtotal || total),
          discount_amount: Number(ord.discount_amount || 0),
          tax_amount: Number(ord.gst_amount || 0),
          total_amount: total,
          paid_amount: isPaid ? total : 0,
          due_amount: isPaid ? 0 : total,
          status: isPaid ? 'paid' : (ord.payment_status || 'pending'),
          remarks: `Order #${ord.order_id}`,
          created_at: ord.created_at,
        };
      }
    }

    // If still not found, check if it's a subscription
    if (!rawBill) {
      const subRows = await this.db.query(
        `SELECT s.subscription_id, s.subscription_number, s.customer_id, s.payment_type,
                s.status, s.start_date, s.end_date, s.created_at
         FROM public.subscriptions s
         WHERE s.subscription_id = $1::varchar OR s.subscription_id = $2::varchar
            OR s.subscription_number = $1::varchar OR s.subscription_number = $2::varchar
         LIMIT 1`,
        [cleanId, strippedId],
      ).catch(() => []);

      if (subRows?.[0]) {
        const sub = subRows[0];
        const isPaid = (sub.payment_type || '').toLowerCase() === 'prepaid';
        rawBill = {
          bill_id: `BILL_${sub.subscription_number || sub.subscription_id}`,
          reference_id: sub.subscription_id,
          customer_id: sub.customer_id,
          bill_type: 'subscription',
          payment_type: sub.payment_type || 'prepaid',
          payment_method: 'wallet',
          billing_from: sub.start_date || sub.created_at,
          billing_to: sub.end_date || sub.start_date || sub.created_at,
          due_date: sub.created_at,
          subtotal: 0,
          discount_amount: 0,
          tax_amount: 0,
          total_amount: 0,
          paid_amount: 0,
          due_amount: 0,
          status: isPaid ? 'paid' : 'due',
          remarks: `Subscription #${sub.subscription_number || sub.subscription_id}`,
          created_at: sub.created_at,
        };
      }
    }

    if (!rawBill) return null;

    // 2. Fetch customer identity from users / customers / branches
    let customerName = rawBill.customer_id;
    let customerPhone = '';
    let customerEmail = '';
    let branchName = 'Main Hub';
    let branchAddress = 'Farm to Home Fresh Distribution';
    let branchPhone = '+91 9876543210';
    let customerAddress = '';

    try {
      const uRows = await this.db.query(
        `SELECT u.first_name, u.last_name, u.user_name, u.phone, u.email, c.branch_id, b.branch_name, b.address AS branch_address, b.contact_mobile AS branch_phone
         FROM public.customers c
         LEFT JOIN public.users u ON u.user_id = c.customer_id
         LEFT JOIN public.branches b ON b.branch_id = c.branch_id
         WHERE c.customer_id = $1::varchar
         LIMIT 1`,
        [rawBill.customer_id],
      ).catch(() => []);

      if (uRows?.[0]) {
        const u = uRows[0];
        customerName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.user_name || u.email || rawBill.customer_id;
        customerPhone = u.phone || '';
        customerEmail = u.email || '';
        if (u.branch_name) branchName = u.branch_name;
        if (u.branch_address) branchAddress = u.branch_address;
        if (u.branch_phone) branchPhone = u.branch_phone;
      }
    } catch {
      // Deliberately tolerated: the caller has a valid fallback for this failure.
    }

    // 3. Fetch default address & contact fallbacks
    try {
      const addrRows = await this.db.query(
        `SELECT contact_name, contact_mobile, flat_no, building_name, street, area, city, pincode, address_line
         FROM public.customer_addresses
         WHERE customer_id = $1::varchar
         ORDER BY is_default DESC, created_at DESC
         LIMIT 1`,
        [rawBill.customer_id],
      ).catch(() => []);

      if (addrRows?.[0]) {
        const a = addrRows[0];
        customerAddress = [a.flat_no, a.building_name, a.street, a.area, a.city, a.pincode].filter(Boolean).join(', ') || a.address_line || '';
        if (!customerPhone && a.contact_mobile) customerPhone = a.contact_mobile;
        if (customerName === rawBill.customer_id && a.contact_name) customerName = a.contact_name;
      }
    } catch {
      // Deliberately tolerated: the caller has a valid fallback for this failure.
    }

    const bill = {
      bill_id: rawBill.bill_id,
      bill_number: rawBill.bill_id,
      customer_id: rawBill.customer_id,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      branch_name: branchName,
      branch_address: branchAddress,
      branch_phone: branchPhone,
      customer_address: customerAddress,
      bill_type: rawBill.bill_type || 'subscription',
      payment_type: rawBill.payment_type || 'postpaid',
      payment_method: rawBill.payment_method || 'wallet',
      period_start: rawBill.billing_from,
      period_end: rawBill.billing_to,
      due_date: rawBill.due_date,
      subtotal: rawBill.subtotal || rawBill.total_amount,
      tax_amount: rawBill.tax_amount || 0,
      discount_amount: rawBill.discount_amount || 0,
      total_amount: rawBill.total_amount || 0,
      paid_amount: rawBill.paid_amount || 0,
      due_amount: rawBill.due_amount || 0,
      status: rawBill.status || 'draft',
      remarks: rawBill.remarks || '',
      created_at: rawBill.created_at,
      updated_at: rawBill.updated_at,
    };

    // 4. Fetch line items from customer_bill_items
    let orderItems: any[] = [];
    try {
      const itemsSql = `
        SELECT 
          cbi.id,
          cbi.reference_type,
          cbi.reference_id,
          cbi.product_variant_id,
          COALESCE(
            NULLIF(TRIM(CONCAT(pr.name, ' - ', pv.name)), ' - '),
            pv.name,
            pr.name,
            'Farm Fresh Produce'
          ) AS item_name,
          COALESCE(pr.name, '') AS product_name,
          COALESCE(pv.name, '') AS variant_name,
          cbi.quantity,
          cbi.unit_price,
          cbi.discount_amount,
          cbi.tax_amount,
          cbi.total_amount,
          cbi.created_at
        FROM public.customer_bill_items cbi
        LEFT JOIN public.product_variants pv ON (pv.variant_id = cbi.product_variant_id)
        LEFT JOIN public.products pr ON (pr.product_id = pv.product_id)
        WHERE (cbi.bill_id = $1::varchar OR cbi.bill_id = $2::varchar) AND cbi.deleted_at IS NULL
        ORDER BY cbi.id ASC
      `;
      const itemRows = await this.db.query(itemsSql, [rawBill.bill_id, cleanId]).catch(() => []);
      if (Array.isArray(itemRows) && itemRows.length > 0) {
        orderItems = itemRows;
      }
    } catch {
      // Deliberately tolerated: the caller has a valid fallback for this failure.
    }

    // 5. Fetch from subscription_items if bill references a subscription
    if (!orderItems || orderItems.length === 0) {
      try {
        const subId = rawBill.reference_id || rawBill.bill_id || cleanId;
        const subItemSql = `
          SELECT 
            si.subscription_item_id AS id,
            'subscription' AS reference_type,
            si.subscription_id AS reference_id,
            si.product_variant_id,
            COALESCE(
              NULLIF(TRIM(CONCAT(pr.name, ' - ', pv.name)), ' - '),
              pr.name,
              pv.name,
              'Subscription Item'
            ) AS item_name,
            COALESCE(pr.name, '') AS product_name,
            COALESCE(pv.name, '') AS variant_name,
            1 AS quantity,
            COALESCE(si.final_price, si.unit_price, 0) AS unit_price,
            COALESCE(si.discount_amount, 0) AS discount_amount,
            0 AS tax_amount,
            COALESCE(si.final_price, si.unit_price, 0) AS total_amount,
            si.created_at
          FROM public.subscription_items si
          LEFT JOIN public.product_variants pv ON pv.variant_id = si.product_variant_id
          LEFT JOIN public.products pr ON pr.product_id = pv.product_id
          WHERE (si.subscription_id = $1::varchar OR si.subscription_id = $2::varchar OR si.subscription_id = $3::varchar)
            AND si.deleted_at IS NULL
        `;
        const subItems = await this.db.query(subItemSql, [
          subId,
          String(subId).replace(/^BILL_/, ''),
          String(subId).replace(/^SUB_/, ''),
        ]).catch(() => []);

        if (Array.isArray(subItems) && subItems.length > 0) {
          orderItems = subItems.map(item => ({
            ...item,
            quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
            unit_price: Number(item.unit_price || 0),
            total_amount: Number(item.total_amount || 0) * (Number(item.quantity) > 0 ? Number(item.quantity) : 1),
          }));
        }
      } catch {
        // Deliberately tolerated: the caller has a valid fallback for this failure.
      }
    }

    // 5.5 Fetch direct line items from order_items if bill references an order
    if (!orderItems || orderItems.length === 0) {
      try {
        const orderIdTarget = rawBill.reference_id || cleanId;
        const directItemsSql = `
          SELECT 
            oi.id,
            'order' AS reference_type,
            oi.order_id AS reference_id,
            oi.variant_id AS product_variant_id,
            COALESCE(
              NULLIF(TRIM(CONCAT(pr.name, ' - ', pv.name)), ' - '),
              pv.name,
              pr.name,
              'Farm Fresh Produce'
            ) AS item_name,
            COALESCE(pr.name, '') AS product_name,
            COALESCE(pv.name, '') AS variant_name,
            COALESCE(oi.quantity, 1) AS quantity,
            COALESCE(oi.unit_price, 0) AS unit_price,
            0 AS discount_amount,
            0 AS tax_amount,
            COALESCE(oi.total_price, oi.unit_price * oi.quantity, 0) AS total_amount,
            oi.created_at
          FROM public.order_items oi
          LEFT JOIN public.product_variants pv ON (pv.variant_id = oi.variant_id)
          LEFT JOIN public.products pr ON (pr.product_id = pv.product_id)
          WHERE (oi.order_id = $1::varchar OR oi.order_id = $2::varchar)
            AND oi.deleted_at IS NULL
          ORDER BY oi.id ASC
        `;
        const directRows = await this.db.query(directItemsSql, [
          orderIdTarget,
          String(orderIdTarget).replace(/^BILL_/, ''),
        ]).catch(() => []);

        if (Array.isArray(directRows) && directRows.length > 0) {
          orderItems = directRows.map((item: any) => ({
            ...item,
            quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
            unit_price: Number(item.unit_price || 0),
            total_amount: Number(item.total_amount || 0),
          }));
        }
      } catch {
        // Deliberately tolerated: the caller has a valid fallback for this failure.
      }
    }

    // 6. Fallback from orders if customer_bill_items & subscription_items empty
    if (!orderItems || orderItems.length === 0) {
      try {
        const orderSql = `
          SELECT 
            o.order_id,
            o.scheduled_date,
            o.total_amount,
            o.delivery_slot,
            o.status,
            COALESCE(
              (SELECT STRING_AGG(COALESCE(NULLIF(TRIM(CONCAT(pr.name, ' - ', pv.name)), ' - '), pv.name, pr.name), ', ') 
               FROM public.order_items oi 
               LEFT JOIN public.product_variants pv ON pv.variant_id = oi.variant_id 
               LEFT JOIN public.products pr ON pr.product_id = pv.product_id 
               WHERE oi.order_id = o.order_id),
              'Subscription Produce Item'
            ) AS item_name
          FROM public.orders o
          WHERE o.order_id = $1::varchar 
             OR o.subscription_id = $1::varchar
             OR (o.customer_id = $2::varchar AND o.scheduled_date::date BETWEEN $3::date AND $4::date)
          ORDER BY o.scheduled_date ASC
        `;
        const pStart = rawBill.billing_from || rawBill.created_at;
        const pEnd = rawBill.billing_to || rawBill.created_at;
        const orders = await this.db.query(orderSql, [
          rawBill.reference_id || rawBill.bill_id,
          rawBill.customer_id,
          pStart,
          pEnd,
        ]).catch(() => []);

        if (Array.isArray(orders) && orders.length > 0) {
          orderItems = orders.map((o: any) => ({
            reference_type: 'order',
            reference_id: o.order_id,
            item_name: o.item_name || 'Daily Supply Delivery',
            quantity: 1,
            unit_price: Number(o.total_amount || 0),
            discount_amount: 0,
            tax_amount: 0,
            total_amount: Number(o.total_amount || 0),
            scheduled_date: o.scheduled_date,
            delivery_slot: o.delivery_slot,
          }));
        }
      } catch {
        // Deliberately tolerated: the caller has a valid fallback for this failure.
      }
    }

    // 7. Reconcile item-level discounts, gross subtotal, and bill discounts
    if (Array.isArray(orderItems) && orderItems.length > 0) {
      orderItems = orderItems.map((it: any) => {
        const qty = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
        const uPrice = Number(it.unit_price || 0);
        const lTotal = Number(it.total_amount || (uPrice * qty));
        const lineGross = uPrice * qty;
        const lineDiscount = Math.max(Number(it.discount_amount || 0), Math.max(0, lineGross - lTotal));
        return {
          ...it,
          quantity: qty,
          unit_price: uPrice,
          total_amount: lTotal,
          discount_amount: lineDiscount,
        };
      });

      const itemsGrossSubtotal = orderItems.reduce(
        (sum: number, it: any) => sum + (Number(it.unit_price || 0) * Number(it.quantity || 1)),
        0,
      );
      const itemsDiscounts = orderItems.reduce(
        (sum: number, it: any) => sum + Number(it.discount_amount || 0),
        0,
      );
      const itemsTaxes = orderItems.reduce(
        (sum: number, it: any) => sum + Number(it.tax_amount || 0),
        0,
      );
      const grandTotal = Number(bill.total_amount || 0);

      const effectiveDiscount = Math.max(
        Number(bill.discount_amount || 0),
        itemsDiscounts,
        Math.max(0, itemsGrossSubtotal - grandTotal),
      );

      bill.discount_amount = effectiveDiscount;
      bill.subtotal = Math.max(
        itemsGrossSubtotal,
        Number(bill.subtotal || 0),
        grandTotal + effectiveDiscount,
      );
      if (itemsTaxes > 0 && !Number(bill.tax_amount)) {
        bill.tax_amount = itemsTaxes;
      }
    }

    return {
      bill,
      items: orderItems,
    };
  }

  async getCompanyProfile(): Promise<any> {
    try {
      const [profileRows, settingRows] = await Promise.all([
        this.db.query(
          `SELECT id, name, legal_name, gst_number, pan_number, email, phone, 
                  secondary_phone, whatsapp, address, city, state, pincode, logo_url, website
           FROM public.company_profile
           ORDER BY created_at ASC NULLS LAST, id ASC
           LIMIT 1`
        ).catch(() => []),
        this.db.query(
          `SELECT key, value FROM public.site_settings`
        ).catch(() => []),
      ]);

      const profile = Array.isArray(profileRows) && profileRows.length > 0 ? profileRows[0] : {};
      const settings: Record<string, string> = {};
      if (Array.isArray(settingRows)) {
        for (const row of settingRows) {
          if (row?.key) settings[row.key] = row.value;
        }
      }

      return {
        name: profile.name || settings.company_name || settings.name || '',
        legal_name: profile.legal_name || settings.legal_name || '',
        gst_number: profile.gst_number || settings.gst_number || '',
        email: profile.email || settings.email || '',
        phone: profile.phone || settings.phone || '',
        address: profile.address || settings.address || '',
        city: profile.city || settings.city || '',
        state: profile.state || settings.state || '',
        pincode: profile.pincode || settings.pincode || '',
        logo_url: profile.logo_url || settings.logo_url || '',
        website: profile.website || settings.website || '',
      };
    } catch {
      return null;
    }
  }

  async getBranches(): Promise<any[]> {
    const sql = `SELECT branch_id, branch_name FROM public.branches WHERE is_active = 1 AND deleted_at IS NULL ORDER BY branch_name ASC`;
    const rows = await this.db.query(sql, []).catch(() => []);
    return Array.isArray(rows) ? rows : [];
  }
}
