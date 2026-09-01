import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../../shared/database/Database.service';
import { GetCustomerBillsQueryDto } from '../dto/customer-billing.dto';
import { generateId } from '../../../../../helpers/RandomHelper';

@Injectable()
export class CustomerBillingRepository {
  private readonly logger = new Logger(CustomerBillingRepository.name);

  constructor(private readonly databaseService: DatabaseService) { }

  async findEligiblePostpaidCustomers(): Promise<any[]> {
    const sql = `
      SELECT c.customer_id, u.first_name, u.last_name, u.phone, u.email, c.is_postpaid_enabled, c.postpaid_credit_limit
      FROM public.customers c
      JOIN public.users u ON u.user_id = c.customer_id
      WHERE c.is_postpaid_enabled = true AND c.deleted_at IS NULL
      ORDER BY u.first_name ASC, c.customer_id ASC
    `;
    return await this.databaseService.query(sql);
  }

  async findPendingPostpaidBills(): Promise<any[]> {
    const sql = `
      SELECT bill_id as bill_number, customer_id, due_date, status, total_amount, due_amount
      FROM public.customer_bills
      WHERE status != 'paid' AND status != 'cancelled'
    `;
    return await this.databaseService.query(sql).catch(() => []);
  }

  async checkCustomerPostpaidEnabled(customerId: string): Promise<any> {
    const sql = `
      SELECT c.customer_id, u.first_name, u.last_name, u.phone, u.email, c.is_postpaid_enabled, c.postpaid_credit_limit
      FROM public.customers c
      JOIN public.users u ON u.user_id = c.customer_id
      WHERE c.customer_id = $1
      LIMIT 1
    `;
    const rows = await this.databaseService.query(sql, [customerId]);
    return rows?.[0] ?? null;
  }

  // ─── NEW CUSTOMER_BILLS METHODS ──────────────────────────────────────────

  async checkBillExists(customerId: string, periodStart: string, periodEnd: string): Promise<any> {
    const sql = `
      SELECT bill_id, status, total_amount
      FROM public.customer_bills
      WHERE customer_id = $1 AND billing_from = $2 AND billing_to = $3
      LIMIT 1
    `;
    const rows = await this.databaseService.query(sql, [customerId, periodStart, periodEnd]);
    if (!rows || rows.length === 0) return null;
    return {
      id: rows[0].bill_id,
      bill_number: rows[0].bill_id,
      status: rows[0].status,
      total_amount: Number(rows[0].total_amount || 0)
    };
  }

  async findDeliveredOrdersForPeriod(
    customerId: string,
    periodStart: string,
    periodEnd: string,
    isPostpaid = true,
  ): Promise<any[]> {
    const sql = `
      SELECT orders.id, orders.order_id, orders.subscription_id, orders.scheduled_date,
        orders.total_amount,
        orders.status, orders.order_source, orders.payment_status,
        COALESCE(
          (SELECT STRING_AGG(COALESCE(pv.name, pr.name), ', ') 
           FROM public.order_items oi 
           LEFT JOIN public.product_variants pv ON pv.variant_id = oi.variant_id 
           LEFT JOIN public.products pr ON pr.product_id = pv.product_id 
           WHERE oi.order_id = orders.order_id),
          'Standard Order'
        ) AS order_name
      FROM public.orders
      WHERE orders.customer_id = $1
        AND orders.status = 'delivered'
        AND orders.subscription_id IS NOT NULL
        AND orders.scheduled_date::date BETWEEN $2::date AND $3::date
        AND EXISTS (
          SELECT 1 FROM public.subscriptions s
          WHERE s.subscription_id = orders.subscription_id
            AND s.payment_type = 'postpaid'
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.customer_bill_items cbi
          WHERE cbi.reference_type = 'order' AND cbi.reference_id = orders.order_id
        )
      ORDER BY orders.scheduled_date ASC
    `;
    return await this.databaseService.query(sql, [customerId, periodStart, periodEnd]);
  }

  async createBillTransaction(
    customerId: string,
    periodStart: string,
    periodEnd: string,
    dueDate: string,
    orders: any[],
    totalAmount: number,
    paidAmount: number,
    status: string,
    paymentType: string,
  ): Promise<any> {
    return await this.databaseService.transaction(async (client) => {
      const billId = `BILL-${generateId('PB', 10)}`;
      const referenceId = orders && orders.length > 0 ? orders[0].order_id : 'CONSOLIDATED';
      const dueAmount = Math.max(0, totalAmount - paidAmount);

      // `customer_bills.payment_method` is NOT NULL with no default, but a monthly
      // postpaid bill is raised before anyone pays it — there is no method to record
      // yet. Omitting the column made every insert die with 23502 and the monthly
      // cron produce nothing. 'pending' stands in until `updateBillPayment` writes
      // the method the bill was actually settled with.
      const paymentMethod = paidAmount >= totalAmount && totalAmount > 0 ? 'wallet' : 'pending';

      const insertBillSql = `
        INSERT INTO public.customer_bills (
          bill_id, customer_id, bill_type, reference_id, payment_type, payment_method,
          billing_from, billing_to, due_date, subtotal, discount_amount,
          tax_amount, total_amount, paid_amount, due_amount, status,
          remarks, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
        RETURNING bill_id AS id, bill_id AS bill_number, total_amount, status
      `;
      const billRes = await client.query(insertBillSql, [
        billId,
        customerId,
        'order',
        referenceId,
        paymentType,
        paymentMethod,
        periodStart,
        periodEnd,
        dueDate,
        totalAmount,
        0,
        0,
        totalAmount,
        paidAmount,
        dueAmount,
        status,
        paymentType === 'postpaid' ? 'Consolidated postpaid bill' : 'Consolidated prepaid bill',
      ]);
      const bill = billRes.rows[0];

      if (orders && orders.length > 0) {
        for (const ord of orders) {
          const orderItems = await client.query(
            `SELECT variant_id, quantity, COALESCE(NULLIF(final_price, 0), unit_price) AS unit_price FROM public.order_items WHERE order_id = $1`,
            [ord.order_id],
          );
          const items = orderItems.rows || [];
          if (items.length > 0) {
            for (const item of items) {
              const itemTotal = Number(item.unit_price || 0) * Number(item.quantity || 1);
              await client.query(
                `INSERT INTO public.customer_bill_items (
                  bill_id, reference_type, reference_id, product_variant_id,
                  quantity, unit_price, discount_amount, tax_amount, total_amount, created_at
                )
                VALUES ($1, 'order', $2, $3, $4, $5, 0, 0, $6, NOW())`,
                [
                  billId,
                  ord.order_id,
                  item.variant_id,
                  item.quantity,
                  item.unit_price,
                  itemTotal,
                ],
              );
            }
          } else {
            await client.query(
              `INSERT INTO public.customer_bill_items (
                bill_id, reference_type, reference_id, product_variant_id,
                quantity, unit_price, discount_amount, tax_amount, total_amount, created_at
              )
              VALUES ($1, 'order', $2, 'dummy_variant', 1, $3, 0, 0, $3, NOW())`,
              [billId, ord.order_id, Number(ord.total_amount || 0)],
            );
          }
        }
      }

      return bill;
    });
  }

  async appendOrdersToExistingBill(
    billId: string,
    orders: any[],
    addedAmount: number,
  ): Promise<any> {
    return await this.databaseService.transaction(async (client) => {
      const updateSql = `
        UPDATE public.customer_bills
        SET total_amount = total_amount + $1,
            due_amount = GREATEST(0, due_amount + $1),
            updated_at = NOW()
        WHERE bill_id = $2
        RETURNING bill_id AS id, bill_id AS bill_number, total_amount, status
      `;
      const billRes = await client.query(updateSql, [addedAmount, billId]);
      const bill = billRes.rows[0];

      if (orders && orders.length > 0) {
        for (const ord of orders) {
          const orderItems = await client.query(
            `SELECT variant_id, quantity, unit_price FROM public.order_items WHERE order_id = $1`,
            [ord.order_id],
          );
          const items = orderItems.rows || [];
          if (items.length > 0) {
            for (const item of items) {
              const itemTotal = Number(item.unit_price || 0) * Number(item.quantity || 1);
              await client.query(
                `INSERT INTO public.customer_bill_items (
                  bill_id, reference_type, reference_id, product_variant_id,
                  quantity, unit_price, discount_amount, tax_amount, total_amount, created_at
                )
                VALUES ($1, 'order', $2, $3, $4, $5, 0, 0, $6, NOW())`,
                [
                  billId,
                  ord.order_id,
                  item.variant_id,
                  item.quantity,
                  item.unit_price,
                  itemTotal,
                ],
              );
            }
          } else {
            await client.query(
              `INSERT INTO public.customer_bill_items (
                bill_id, reference_type, reference_id, product_variant_id,
                quantity, unit_price, discount_amount, tax_amount, total_amount, created_at
              )
              VALUES ($1, 'order', $2, 'dummy_variant', 1, $3, 0, 0, $3, NOW())`,
              [billId, ord.order_id, Number(ord.total_amount || 0)],
            );
          }
        }
      }

      return bill;
    });
  }

  async findBills(query: GetCustomerBillsQueryDto): Promise<{ bills: any[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (query.customerId) {
      conditions.push(`pb.customer_id = $${paramIndex++}`);
      params.push(query.customerId);
    }

    if (query.status && query.status.toLowerCase() !== 'all') {
      const st = query.status.toLowerCase();
      if (st === 'overdue') {
        conditions.push(`(LOWER(pb.status::text) = 'overdue' OR (pb.due_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date AND pb.due_amount > 0))`);
      } else if (st === 'pending') {
        conditions.push(`(LOWER(pb.status::text) = 'pending' OR LOWER(pb.status::text) = 'unpaid' OR LOWER(pb.status::text) = 'partial') AND pb.due_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date AND pb.due_amount > 0`);
      } else if (st === 'paid') {
        conditions.push(`(pb.due_amount <= 0 OR LOWER(pb.status::text) = 'paid')`);
      } else if (st === 'subscription') {
        conditions.push(`(pb.bill_type = 'subscription' OR EXISTS (
          SELECT 1 FROM public.customer_bill_items cbi
          JOIN public.orders o ON o.order_id = cbi.reference_id
          WHERE cbi.bill_id = pb.bill_id AND cbi.reference_type = 'order' AND o.order_source = 'subscription'
        ))`);
      } else if (st === 'one_time' || st === 'one-time') {
        conditions.push(`(pb.bill_type = 'order' OR EXISTS (
          SELECT 1 FROM public.customer_bill_items cbi
          JOIN public.orders o ON o.order_id = cbi.reference_id
          WHERE cbi.bill_id = pb.bill_id AND cbi.reference_type = 'order' AND o.order_source = 'one-time'
        ))`);
      } else {
        conditions.push(`LOWER(pb.status::text) = $${paramIndex++}`);
        params.push(st);
      }
    }

    if (query.search) {
      conditions.push(`(pb.bill_id ILIKE $${paramIndex} OR pb.customer_id ILIKE $${paramIndex} OR c.first_name ILIKE $${paramIndex})`);
      params.push(`%${query.search}%`);
      paramIndex++;
    }

    if (query.type) {
      if (query.type === 'postpaid') {
        conditions.push(`pb.payment_type = 'postpaid'`);
      } else if (query.type === 'prepaid') {
        conditions.push(`pb.payment_type = 'prepaid'`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total
      FROM public.customer_bills pb
      LEFT JOIN public.customers c ON c.customer_id = pb.customer_id
      ${whereClause}
    `;
    const countRows = await this.databaseService.query(countSql, params);
    const total = Number(countRows?.[0]?.total || 0);

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
    const offset = (page - 1) * limit;

    const dataSql = `
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
        COALESCE(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), u.user_name, 'Customer') AS customer_name,
        pb.payment_type = 'postpaid' AS is_postpaid_enabled,
        (
          SELECT COUNT(*)
          FROM public.customer_bill_items cbi
          WHERE cbi.bill_id = pb.bill_id
        ) AS order_count
      FROM public.customer_bills pb
      LEFT JOIN public.customers c ON c.customer_id = pb.customer_id
      LEFT JOIN public.users u ON u.user_id = pb.customer_id
      ${whereClause}
      ORDER BY pb.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    const dataParams = [...params, limit, offset];
    const bills = await this.databaseService.query(dataSql, dataParams);

    return { bills, total };
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
        pb.bill_type,
        pb.reference_id,
        COALESCE(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), u.user_name, 'Customer') AS customer_name,
        u.phone AS customer_phone,
        pb.payment_type = 'postpaid' AS is_postpaid_enabled
      FROM public.customer_bills pb
      LEFT JOIN public.customers c ON c.customer_id = pb.customer_id
      LEFT JOIN public.users u ON u.user_id = pb.customer_id
      WHERE pb.bill_id = $1::varchar
      LIMIT 1
    `;
    const rows = await this.databaseService.query(sql, [id]);
    if (!rows || rows.length === 0) return null;
    const bill = rows[0];

    // Query actual orders if they exist
    let orders: any[] = [];
    if (bill.bill_type === 'order') {
      const ordersSql = `
        SELECT 
          o.order_id,
          o.scheduled_date,
          o.total_amount AS order_amount,
          o.status,
          o.delivery_slot,
          o.order_source,
          o.payment_status,
          COALESCE(
            (SELECT STRING_AGG(COALESCE(pv.name, pr.name), ', ') 
             FROM public.order_items oi 
             LEFT JOIN public.product_variants pv ON pv.variant_id = oi.variant_id 
             LEFT JOIN public.products pr ON pr.product_id = pv.product_id 
             WHERE oi.order_id = o.order_id),
            'Standard Order'
          ) AS order_name
        FROM public.orders o
        WHERE o.order_id IN (
          SELECT DISTINCT reference_id 
          FROM public.customer_bill_items 
          WHERE bill_id = $1::varchar AND reference_type = 'order'
        )
      `;
      orders = await this.databaseService.query(ordersSql, [bill.id]);
    } else if (bill.bill_type === 'subscription') {
      const ordersSql = `
        SELECT 
          o.order_id,
          o.scheduled_date,
          o.total_amount AS order_amount,
          o.status,
          o.delivery_slot,
          o.order_source,
          o.payment_status,
          COALESCE(
            (SELECT STRING_AGG(COALESCE(pv.name, pr.name), ', ') 
             FROM public.order_items oi 
             LEFT JOIN public.product_variants pv ON pv.variant_id = oi.variant_id 
             LEFT JOIN public.products pr ON pr.product_id = pv.product_id 
             WHERE oi.order_id = o.order_id),
            'Standard Order'
          ) AS order_name
        FROM public.orders o
        WHERE o.subscription_id = $1::varchar
          AND o.scheduled_date::date BETWEEN $2::date AND $3::date
        ORDER BY o.scheduled_date ASC
      `;
      orders = await this.databaseService.query(ordersSql, [bill.reference_id, bill.period_start, bill.period_end]);
    }

    // Fallback: If no orders are found, construct items from customer_bill_items
    if (!orders || orders.length === 0) {
      const itemsSql = `
        SELECT 
          cbi.product_variant_id AS order_id,
          pv.name AS order_name,
          cbi.created_at::date AS scheduled_date,
          cbi.total_amount AS order_amount,
          'confirmed' AS status,
          'Standard' AS delivery_slot,
          $2::varchar AS order_source,
          'paid' AS payment_status
        FROM public.customer_bill_items cbi
        LEFT JOIN public.product_variants pv ON pv.variant_id = cbi.product_variant_id
        WHERE cbi.bill_id = $1::varchar AND cbi.reference_type = 'order'
      `;
      orders = await this.databaseService.query(itemsSql, [bill.id, bill.bill_type]);
    }

    bill.ordersIncluded = orders.map((o: any) => ({
      orderId: o.order_id,
      orderName: o.order_name || 'Standard Order',
      scheduledDate: o.scheduled_date,
      orderAmount: Number(o.order_amount || 0),
      status: o.status,
      deliverySlot: o.delivery_slot,
      orderSource: o.order_source,
      paymentStatus: o.payment_status,
    }));

    return bill;
  }

  /**
   * Records a payment against a bill.
   *
   * [paymentMethod] is how the bill was actually settled. It used to be dropped on
   * the floor here, which left every generated bill reading 'pending' forever even
   * after it was paid; passing null keeps whatever the bill already carries.
   */
  async updateBillPayment(
    id: string,
    paidAmount: number,
    status: string,
    paymentMethod?: string | null,
  ): Promise<any> {
    const sql = `
      UPDATE public.customer_bills
      SET paid_amount = $2,
          due_amount = GREATEST(0, total_amount - $2),
          status = $3,
          payment_method = COALESCE($4, payment_method),
          updated_at = NOW()
      WHERE bill_id = $1::varchar
      RETURNING bill_id AS id, bill_id AS bill_number, total_amount, status, payment_method
    `;
    const rows = await this.databaseService.query(sql, [
      id,
      paidAmount,
      status,
      paymentMethod?.trim() ? paymentMethod.trim().toLowerCase() : null,
    ]);
    return rows?.[0] ?? null;
  }
}


