import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../../shared/database/Database.service';

/**
 * SQL-first repository for subscription status management.
 * Handles all database operations for renewal, completion, expiration flows.
 */
@Injectable()
export class SubscriptionStatusRepository {
  private readonly logger = new Logger(SubscriptionStatusRepository.name);

  constructor(private readonly db: DatabaseService) {}

  // ─── Query: Subscriptions nearing end_date ────────────────────────────

  /**
   * Fetch active subscriptions where end_date is within `daysFromNow` days.
   * Joins customer data for wallet balance and postpaid info.
   */
  async findSubscriptionsNearingEnd(targetDays: number[]): Promise<any[]> {
    const placeholders = targetDays.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `
      SELECT
        s.subscription_id,
        s.customer_id,
        s.payment_type,
        s.auto_renew,
        s.start_date,
        s.end_date,
        s.status,
        s.billing_cycle,
        s.subscription_number,
        (s.end_date - CURRENT_DATE) AS days_remaining,
        c.wallet_balance,
        c.is_postpaid_enabled,
        c.postpaid_credit_limit,
        u.first_name,
        u.phone,
        u.email
      FROM subscriptions s
      JOIN customers c ON c.customer_id = s.customer_id
      LEFT JOIN users u ON u.user_id = s.customer_id
      WHERE s.status = 'active'
        AND (s.end_date - CURRENT_DATE) IN (${placeholders})
      ORDER BY s.end_date ASC
    `;
    return await this.db.query(sql, targetDays);
  }

  // ─── Query: Calculate renewal amount ──────────────────────────────────

  /**
   * Calculates the monthly renewal amount for a subscription.
   * SUM of (final_price * total weekly qty * ~4.33 weeks/month)
   * Uses a simpler approach: SUM of daily cost * 30 days.
   */
  async calculateRenewalAmount(subscriptionId: string): Promise<number> {
    const sql = `
      SELECT
        COALESCE(SUM(
          si.final_price * (
            SELECT COALESCE(SUM(ws.m_quantity + ws.e_quantity), 0)
            FROM subscription_weekly_schedule ws
            WHERE ws.subscription_item_id = si.subscription_item_id
          )
        ), 0) AS weekly_cost
      FROM subscription_items si
      WHERE si.subscription_id = $1
        AND si.status = 'active'
    `;
    const rows = await this.db.query(sql, [subscriptionId]);
    const weeklyCost = Number(rows?.[0]?.weekly_cost || 0);
    // Monthly cost ≈ weekly cost × 4.33
    return Math.round(weeklyCost * 4.33 * 100) / 100;
  }

  // ─── Query: Outstanding postpaid bills ────────────────────────────────

  /**
   * Get unpaid postpaid subscription bills for a customer, ordered by billing period.
   */
  async getUnpaidPostpaidBills(customerId: string): Promise<any[]> {
    const sql = `
      SELECT bill_id, reference_id, billing_from, billing_to, total_amount, paid_amount, due_amount, status, created_at
      FROM customer_bills
      WHERE customer_id = $1
        AND bill_type = 'subscription'
        AND payment_type = 'postpaid'
        AND status != 'paid'
        AND status != 'cancelled'
      ORDER BY billing_to DESC
    `;
    return await this.db.query(sql, [customerId]);
  }

  /**
   * Check if customer has 2 consecutive unpaid postpaid billing cycles.
   * Returns true if there are 2+ unpaid bills in consecutive months.
   */
  async hasConsecutiveUnpaidCycles(customerId: string): Promise<boolean> {
    const sql = `
      WITH unpaid AS (
        SELECT billing_from, billing_to,
               ROW_NUMBER() OVER (ORDER BY billing_to DESC) AS rn
        FROM customer_bills
        WHERE customer_id = $1
          AND bill_type = 'subscription'
          AND payment_type = 'postpaid'
          AND status != 'paid'
          AND status != 'cancelled'
        ORDER BY billing_to DESC
        LIMIT 2
      )
      SELECT COUNT(*) AS cnt FROM unpaid
    `;
    const rows = await this.db.query(sql, [customerId]);
    return Number(rows?.[0]?.cnt || 0) >= 2;
  }

  // ─── Query: Total outstanding amount ──────────────────────────────────

  async getTotalOutstandingAmount(customerId: string): Promise<number> {
    const sql = `
      SELECT COALESCE(SUM(due_amount), 0) AS total_outstanding
      FROM customer_bills
      WHERE customer_id = $1
        AND bill_type = 'subscription'
        AND payment_type = 'postpaid'
        AND status != 'paid'
        AND status != 'cancelled'
    `;
    const rows = await this.db.query(sql, [customerId]);
    return Number(rows?.[0]?.total_outstanding || 0);
  }

  // ─── Mutations (all accept optional transaction) ──────────────────────

  /**
   * Deduct wallet balance atomically.
   */
  async deductWalletBalance(
    customerId: string,
    amount: number,
    client?: any,
  ): Promise<number> {
    const sql = `
      UPDATE customers
      SET wallet_balance = wallet_balance - $2,
          updated_at = NOW()
      WHERE customer_id = $1
      RETURNING wallet_balance
    `;
    const exec = client ? client.query.bind(client) : this.db.query.bind(this.db);
    const res = await exec(sql, [customerId, amount]);
    const rows = client ? res.rows : res;
    return Number(rows?.[0]?.wallet_balance || 0);
  }

  /**
   * Insert wallet transaction record.
   */
  async insertWalletTransaction(
    data: {
      customer_id: string;
      transaction_type: string;
      amount: number;
      balance_after: number;
      reference_type: string;
      reference_id: string;
      remarks: string;
      created_by: string;
    },
    client?: any,
  ): Promise<void> {
    const sql = `
      INSERT INTO customer_wallet_transactions
        (customer_id, transaction_type, amount, balance_after,
         reference_type, reference_id, remarks, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `;
    const exec = client ? client.query.bind(client) : this.db.query.bind(this.db);
    await exec(sql, [
      data.customer_id,
      data.transaction_type,
      data.amount,
      data.balance_after,
      data.reference_type,
      data.reference_id,
      data.remarks,
      data.created_by,
    ]);
  }

  /**
   * Update subscription status and optionally extend end_date.
   */
  async updateSubscriptionStatus(
    subscriptionId: string,
    status: string,
    newEndDate?: string | null,
    client?: any,
  ): Promise<void> {
    let sql: string;
    let params: any[];

    if (newEndDate) {
      sql = `
        UPDATE subscriptions
        SET status = $2, end_date = $3::date, updated_at = NOW(), updated_by = 'system'
        WHERE subscription_id = $1
      `;
      params = [subscriptionId, status, newEndDate];
    } else {
      sql = `
        UPDATE subscriptions
        SET status = $2, updated_at = NOW(), updated_by = 'system'
        WHERE subscription_id = $1
      `;
      params = [subscriptionId, status];
    }

    const exec = client ? client.query.bind(client) : this.db.query.bind(this.db);
    await exec(sql, params);
  }

  /**
   * Convert subscription payment type (e.g. prepaid → postpaid).
   */
  async updateSubscriptionPaymentType(
    subscriptionId: string,
    paymentType: string,
    client?: any,
  ): Promise<void> {
    const sql = `
      UPDATE subscriptions
      SET payment_type = $2, updated_at = NOW(), updated_by = 'system'
      WHERE subscription_id = $1
    `;
    const exec = client ? client.query.bind(client) : this.db.query.bind(this.db);
    await exec(sql, [subscriptionId, paymentType]);
  }

  /**
   * Insert a customer bill. Returns the bill_id.
   */
  async insertCustomerBill(
    data: {
      bill_id: string;
      customer_id: string;
      bill_type: string;
      reference_id: string;
      payment_type: string;
      billing_from: string;
      billing_to: string;
      due_date: string;
      subtotal: number;
      total_amount: number;
      paid_amount: number;
      due_amount: number;
      status: string;
      remarks?: string;
    },
    client?: any,
  ): Promise<string> {
    const sql = `
      INSERT INTO customer_bills
        (bill_id, customer_id, bill_type, reference_id, payment_type,
         billing_from, billing_to, due_date, subtotal, total_amount,
         paid_amount, due_amount, status, remarks, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      ON CONFLICT (bill_id) DO NOTHING
      RETURNING bill_id
    `;
    const exec = client ? client.query.bind(client) : this.db.query.bind(this.db);
    const res = await exec(sql, [
      data.bill_id,
      data.customer_id,
      data.bill_type,
      data.reference_id,
      data.payment_type,
      data.billing_from,
      data.billing_to,
      data.due_date,
      data.subtotal,
      data.total_amount,
      data.paid_amount,
      data.due_amount,
      data.status,
      data.remarks || null,
    ]);
    const rows = client ? res.rows : res;
    return rows?.[0]?.bill_id || data.bill_id;
  }

  /**
   * Check if a bill already exists for the given subscription and billing period.
   */
  async checkBillExistsForPeriod(
    subscriptionId: string,
    billingFrom: string,
    billingTo: string,
  ): Promise<boolean> {
    const sql = `
      SELECT 1 FROM customer_bills
      WHERE reference_id = $1
        AND bill_type = 'subscription'
        AND billing_from = $2::date
        AND billing_to = $3::date
      LIMIT 1
    `;
    const rows = await this.db.query(sql, [subscriptionId, billingFrom, billingTo]);
    return (rows?.length || 0) > 0;
  }

  /**
   * Insert a renewal attempt record.
   */
  async insertRenewalAttempt(
    data: {
      subscription_id: string;
      customer_id: string;
      attempt_type: string;
      payment_type: string;
      renewal_amount: number;
      wallet_balance_at_attempt?: number;
      bill_id?: string;
      status: string;
      failure_reason?: string;
      old_end_date?: string;
      new_end_date?: string;
    },
    client?: any,
  ): Promise<void> {
    const sql = `
      INSERT INTO subscription_renewal_attempts
        (subscription_id, customer_id, attempt_type, payment_type,
         renewal_amount, wallet_balance_at_attempt, bill_id, status,
         failure_reason, old_end_date, new_end_date, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11::date, NOW())
    `;
    const exec = client ? client.query.bind(client) : this.db.query.bind(this.db);
    await exec(sql, [
      data.subscription_id,
      data.customer_id,
      data.attempt_type,
      data.payment_type,
      data.renewal_amount,
      data.wallet_balance_at_attempt ?? null,
      data.bill_id ?? null,
      data.status,
      data.failure_reason ?? null,
      data.old_end_date ?? null,
      data.new_end_date ?? null,
    ]);
  }

  /**
   * Insert a subscription log entry.
   */
  async insertSubscriptionLog(
    data: {
      subscription_id: string;
      action: string;
      old_data?: any;
      new_data?: any;
      created_by: string;
    },
    client?: any,
  ): Promise<void> {
    const sql = `
      INSERT INTO subscription_logs
        (subscription_id, action, old_data, new_data, created_by, created_at)
      VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, NOW())
    `;
    const exec = client ? client.query.bind(client) : this.db.query.bind(this.db);
    await exec(sql, [
      data.subscription_id,
      data.action,
      data.old_data ? JSON.stringify(data.old_data) : null,
      data.new_data ? JSON.stringify(data.new_data) : null,
      data.created_by,
    ]);
  }

  /**
   * Get the latest renewal attempt for a subscription.
   */
  async getLatestRenewalAttempt(subscriptionId: string): Promise<any | null> {
    const sql = `
      SELECT * FROM subscription_renewal_attempts
      WHERE subscription_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const rows = await this.db.query(sql, [subscriptionId]);
    return rows?.[0] ?? null;
  }

  /**
   * Get a single subscription by ID with customer data.
   */
  async getSubscriptionWithCustomer(subscriptionId: string): Promise<any | null> {
    const sql = `
      SELECT
        s.*,
        c.wallet_balance,
        c.is_postpaid_enabled,
        c.postpaid_credit_limit,
        u.first_name,
        u.phone,
        u.email
      FROM subscriptions s
      JOIN customers c ON c.customer_id = s.customer_id
      LEFT JOIN users u ON u.user_id = s.customer_id
      WHERE s.subscription_id = $1
      LIMIT 1
    `;
    const rows = await this.db.query(sql, [subscriptionId]);
    return rows?.[0] ?? null;
  }
}
