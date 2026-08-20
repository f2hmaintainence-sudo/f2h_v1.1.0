import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  TableHelper,
  TableSet,
  JoinDef,
  CustomDef,
  ReqSet,
} from '../../../helpers/TableHelper';
import { DataService } from '../../../shared/database/Data.service';
import { DatabaseService } from '../../../shared/database/Database.service';
import { DeveloperService } from '../../../shared/logger/Developer.service';

@Injectable()
export class CustomersService {
  constructor(
    private readonly tableHelper: TableHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly databaseService: DatabaseService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // UNIFIED CUSTOMER INTELLIGENCE LIST & 360 PORTFOLIO
  // ═══════════════════════════════════════════════════════════════

  async getCustomerIntelligenceList(query: any) {
    try {
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.max(1, Math.min(100, parseInt(query.limit || '12', 10)));
      const offset = (page - 1) * limit;

      const search = query.search?.trim() || '';
      const status = query.status || '';
      const typeFilter = query.type || '';
      const walletFilter = query.wallet || '';
      const dueFilter = query.due || '';
      const branchId = query.branchId || query.branch_id || '';
      const sortBy = query.sortBy || 'created_at';
      const sortDir = query.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const whereClauses: string[] = ['c.deleted_at IS NULL'];
      const params: any[] = [];

      if (search) {
        params.push(`%${search}%`);
        const pIdx = params.length;
        whereClauses.push(`(
          c.customer_id ILIKE $${pIdx} OR 
          COALESCE(u.first_name, '') ILIKE $${pIdx} OR 
          COALESCE(u.last_name, '') ILIKE $${pIdx} OR 
          COALESCE((COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') ILIKE $${pIdx} OR 
          COALESCE(u.user_name, '') ILIKE $${pIdx} OR 
          COALESCE(u.phone, '') ILIKE $${pIdx} OR 
          COALESCE(c.alternate_mobile, '') ILIKE $${pIdx} OR 
          COALESCE(u.email, '') ILIKE $${pIdx}
        )`);
      }

      if (status) {
        params.push(status);
        whereClauses.push(`c.is_active = $${params.length}`);
      }

      if (branchId) {
        params.push(branchId);
        whereClauses.push(`EXISTS (SELECT 1 FROM customer_addresses ca WHERE ca.customer_id = c.customer_id AND ca.branch_id = $${params.length})`);
      }

      if (typeFilter === 'postpaid') {
        whereClauses.push(`c.is_postpaid_enabled = true`);
      } else if (typeFilter === 'subscriber') {
        whereClauses.push(`EXISTS (SELECT 1 FROM subscriptions s WHERE s.customer_id = c.customer_id AND s.status = 'active')`);
      } else if (typeFilter === 'non_subscriber') {
        whereClauses.push(`NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.customer_id = c.customer_id AND s.status = 'active')`);
      } else if (typeFilter === 'vip') {
        whereClauses.push(`c.customer_type = 'vip'`);
      }

      if (walletFilter === 'positive') {
        whereClauses.push(`COALESCE(c.wallet_balance, 0) > 0`);
      } else if (walletFilter === 'negative') {
        whereClauses.push(`COALESCE(c.wallet_balance, 0) < 0`);
      } else if (walletFilter === 'zero') {
        whereClauses.push(`COALESCE(c.wallet_balance, 0) = 0`);
      }

      if (dueFilter === 'has_due') {
        whereClauses.push(`COALESCE(cb.outstanding_due, 0) > 0`);
      } else if (dueFilter === 'no_due') {
        whereClauses.push(`(cb.outstanding_due IS NULL OR cb.outstanding_due = 0)`);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      let orderBySql = 'ORDER BY c.created_at DESC';
      if (sortBy === 'revenue') {
        orderBySql = `ORDER BY COALESCE(ord.lifetime_revenue, 0) ${sortDir}`;
      } else if (sortBy === 'orders') {
        orderBySql = `ORDER BY COALESCE(ord.total_orders, 0) ${sortDir}`;
      } else if (sortBy === 'last_order') {
        orderBySql = `ORDER BY ord.last_order_date ${sortDir} NULLS LAST`;
      } else if (sortBy === 'registration') {
        orderBySql = `ORDER BY c.created_at ${sortDir}`;
      } else if (sortBy === 'wallet') {
        orderBySql = `ORDER BY COALESCE(c.wallet_balance, 0) ${sortDir}`;
      } else if (sortBy === 'due') {
        orderBySql = `ORDER BY COALESCE(cb.outstanding_due, 0) ${sortDir}`;
      } else if (sortBy === 'name') {
        orderBySql = `ORDER BY COALESCE(u.first_name, u.user_name, '') ${sortDir}`;
      }

      const mainSql = `
        WITH order_stats AS (
          SELECT 
            customer_id,
            COUNT(*)::int as total_orders,
            COUNT(CASE WHEN status = 'delivered' THEN 1 END)::int as completed_orders,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int as cancelled_orders,
            COALESCE(SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END), 0)::numeric as lifetime_revenue,
            COALESCE(AVG(CASE WHEN status = 'delivered' THEN total_amount ELSE NULL END), 0)::numeric as avg_order_value,
            MAX(created_at) as last_order_date,
            MAX(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END)::numeric as last_order_amount,
            MAX(delivery_slot) as preferred_delivery_slot,
            MAX(payment_mode) as preferred_payment_method
          FROM orders
          GROUP BY customer_id
        ),
        bill_stats AS (
          SELECT 
            customer_id,
            COALESCE(SUM(due_amount), 0)::numeric as outstanding_due
          FROM customer_bills
          WHERE status != 'paid' AND status != 'cancelled'
          GROUP BY customer_id
        ),
        sub_stats AS (
          SELECT DISTINCT ON (customer_id)
            customer_id,
            subscription_number,
            status as subscription_status,
            billing_cycle,
            schedule_type
          FROM subscriptions
          ORDER BY customer_id, created_at DESC
        )
        SELECT 
          c.customer_id as id,
          c.customer_id,
          COALESCE(u.first_name, '') as first_name,
          COALESCE(u.last_name, '') as last_name,
          COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.user_name, u.phone, 'Customer') as full_name,
          COALESCE(
            NULLIF(u.phone, ''),
            NULLIF(c.alternate_mobile, ''),
            (SELECT NULLIF(ca.contact_mobile, '') FROM customer_addresses ca WHERE ca.customer_id = c.customer_id AND ca.contact_mobile IS NOT NULL AND ca.contact_mobile != '' ORDER BY ca.is_default DESC, ca.id DESC LIMIT 1),
            ''
          ) as phone,
          COALESCE(c.alternate_mobile, '') as alternate_phone,
          u.email,
          c.gender,
          c.dob,
          u.profile_image_url as profile_image,
          c.is_active as customer_status,
          c.customer_type,
          COALESCE(c.wallet_balance, 0)::numeric as wallet_balance,
          COALESCE(c.reward_points, 0)::int as reward_points,
          COALESCE(c.is_postpaid_enabled, false) as is_postpaid_enabled,
          COALESCE(c.postpaid_credit_limit, 0)::numeric as postpaid_credit_limit,
          COALESCE(c.is_blocked, false) as is_blocked,
          c.block_reason,
          sub.subscription_number,
          c.created_at,
          c.updated_at,
          
          COALESCE(ord.lifetime_revenue, 0)::numeric as lifetime_revenue,
          COALESCE(ord.total_orders, 0)::int as total_orders,
          COALESCE(ord.completed_orders, 0)::int as completed_orders,
          COALESCE(ord.cancelled_orders, 0)::int as cancelled_orders,
          COALESCE(ord.avg_order_value, 0)::numeric as avg_order_value,
          ord.last_order_date,
          COALESCE(ord.last_order_amount, 0)::numeric as last_order_amount,
          ord.preferred_delivery_slot,
          ord.preferred_payment_method,
          COALESCE(cb.outstanding_due, 0)::numeric as outstanding_due,
          sub.subscription_status,
          sub.billing_cycle,
          sub.schedule_type
        FROM customers c
        JOIN users u ON u.user_id = c.customer_id
        LEFT JOIN order_stats ord ON ord.customer_id = c.customer_id
        LEFT JOIN bill_stats cb ON cb.customer_id = c.customer_id
        LEFT JOIN sub_stats sub ON sub.customer_id = c.customer_id
        ${whereSql}
        ${orderBySql}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const countSql = `
        SELECT COUNT(DISTINCT c.customer_id)::int as total
        FROM customers c
        JOIN users u ON u.user_id = c.customer_id
        LEFT JOIN (
          SELECT customer_id, COALESCE(SUM(due_amount), 0) as outstanding_due
          FROM customer_bills WHERE status != 'paid' AND status != 'cancelled' GROUP BY customer_id
        ) cb ON cb.customer_id = c.customer_id
        ${whereSql}
      `;

      const statsSql = `
        SELECT 
          COUNT(DISTINCT c.customer_id)::int as total_customers,
          COUNT(DISTINCT CASE WHEN s.status = 'active' THEN c.customer_id END)::int as active_subscribers,
          COUNT(DISTINCT CASE WHEN c.is_postpaid_enabled = true THEN c.customer_id END)::int as postpaid_accounts,
          COUNT(DISTINCT CASE WHEN c.is_blocked = true THEN c.customer_id END)::int as blocked_accounts,
          COALESCE((SELECT SUM(total_amount) FROM orders WHERE status = 'delivered'), 0)::numeric as total_revenue,
          COALESCE((SELECT SUM(due_amount) FROM customer_bills WHERE status != 'paid' AND status != 'cancelled'), 0)::numeric as total_due
        FROM customers c
        LEFT JOIN subscriptions s ON s.customer_id = c.customer_id AND s.status = 'active'
        WHERE c.deleted_at IS NULL
      `;

      const branchesSql = `SELECT branch_id, branch_name FROM branches WHERE deleted_at IS NULL ORDER BY branch_name ASC`;

      const listQueryParams = [...params, limit, offset];
      const [rows, countRes, statsRes, branchesRes] = await Promise.all([
        this.databaseService.query(mainSql, listQueryParams),
        this.databaseService.query(countSql, params),
        this.databaseService.query(statsSql, []),
        this.databaseService.query(branchesSql, []).catch(() => []),
      ]);

      const total = countRes[0]?.total || 0;
      const summaryStats = statsRes[0] || {};

      return {
        status: true,
        data: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        summary: summaryStats,
        branches: branchesRes || [],
      };
    } catch (error: any) {
      console.error('CRITICAL getCustomerIntelligenceList ERROR:', error?.message, error?.stack);
      this.developer.error('CustomersService.getCustomerIntelligenceList error', { error });
      throw new InternalServerErrorException('Failed to fetch customer intelligence list');
    }
  }

  async getCustomerPortfolio(id: string) {
    try {
      const custRes = await this.databaseService.query(
        `SELECT c.*, 
                COALESCE(u.first_name, '') as first_name,
                COALESCE(u.last_name, '') as last_name,
                COALESCE(u.phone, '') as phone,
                COALESCE(u.email, '') as email,
                u.profile_image_url as profile_image
         FROM customers c
         JOIN users u ON u.user_id = c.customer_id
         WHERE c.customer_id = $1`,
        [id]
      );

      if (!custRes || custRes.length === 0) {
        throw new BadRequestException('Customer not found');
      }

      const customer = custRes[0];
      const customerId = customer.customer_id;

      const addresses = await this.databaseService.query(
        `SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC`,
        [customerId]
      );

      const ordersRes = await this.databaseService.query(
        `SELECT o.*, 
                COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.user_name, 'Delivery Partner') as delivery_partner_name,
                u.phone as delivery_partner_phone
         FROM orders o
         LEFT JOIN delivery_partners dp ON dp.delivery_partner_id = o.delivery_partner_id
         LEFT JOIN users u ON u.user_id = dp.user_id
         WHERE o.customer_id = ?
         ORDER BY o.created_at DESC`,
        [customerId]
      );

      let orderItemsMap: Record<string, any[]> = {};
      let orderContainerMap: Record<string, any[]> = {};

      if (ordersRes.length > 0) {
        const orderIds = ordersRes.map(o => o.order_id);
        const itemsRes = await this.databaseService.query(
          `SELECT oi.*, pv.name as variant_name, p.name as product_name_ref
           FROM order_items oi
           LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
           LEFT JOIN products p ON p.product_id = pv.product_id
           WHERE oi.order_id = ANY(?)`,
          [orderIds]
        );
        for (const item of itemsRes) {
          if (!orderItemsMap[item.order_id]) orderItemsMap[item.order_id] = [];
          orderItemsMap[item.order_id].push({
            id: item.id,
            product_name: item.product_name || item.product_name_ref || 'Product Item',
            variant_name: item.variant_name || '',
            quantity: Number(item.quantity || 1),
            unit_price: Number(item.unit_price || 0),
            discount_amount: Number(item.discount_amount || 0),
            tax_amount: Number(item.tax_amount || 0),
            total_price: Number(item.final_price || item.total_price || item.total_amount || 0),
          });
        }
      }

      const formattedOrders = ordersRes.map(o => {
        const status = (o.status || 'pending').toString().toLowerCase();
        const isSubscription = Boolean(o.subscription_id || o.order_source === 'subscription');
        const timeline = [
          { title: 'Order Placed', completed: true, time: o.created_at },
          { title: 'Packed', completed: ['packed', 'dispatched', 'delivered'].includes(status), time: null },
          { title: 'Dispatched', completed: ['dispatched', 'delivered'].includes(status), time: null },
          { title: 'Delivered', completed: status === 'delivered', time: status === 'delivered' ? o.updated_at : null },
        ];
        if (status === 'cancelled') {
          timeline.push({ title: 'Cancelled', completed: true, time: o.updated_at });
        }
        return {
          ...o,
          order_type: isSubscription ? 'Subscription Order' : 'One-Time Purchase',
          is_subscription: isSubscription,
          delivery_partner_phone: o.delivery_partner_phone || null,
          containers: orderContainerMap[o.order_id] || [],
          total_amount: Number(o.total_amount || 0),
          subtotal: Number(o.subtotal || 0),
          discount_amount: Number(o.discount_amount || 0),
          gst_amount: Number(o.gst_amount || 0),
          items: orderItemsMap[o.order_id] || [],
          timeline,
        };
      });

      const completedOrders = formattedOrders.filter(o => o.status?.toString().toLowerCase() === 'delivered');
      const cancelledOrders = formattedOrders.filter(o => o.status?.toString().toLowerCase() === 'cancelled');
      const lifetimeRevenue = completedOrders.reduce((sum, o) => sum + o.total_amount, 0);
      const aov = completedOrders.length > 0 ? lifetimeRevenue / completedOrders.length : 0;
      const maxOrderValue = completedOrders.reduce((max, o) => Math.max(max, o.total_amount), 0);
      const totalDiscounts = formattedOrders.reduce((sum, o) => sum + o.discount_amount, 0);

      // Subscription Orders & Postpaid Ledger Query
      const subOrdersRes = await this.databaseService.query(
        `SELECT o.*, s.subscription_number
         FROM orders o
         LEFT JOIN subscriptions s ON (s.subscription_id = o.subscription_id OR s.subscription_number = o.subscription_id)
         WHERE o.customer_id = ?
           AND (o.subscription_id IS NOT NULL OR o.order_source = 'subscription' OR o.generation_type = 'subscription')
           AND o.deleted_at IS NULL
         ORDER BY o.created_at DESC`,
        [customerId]
      ).catch(() => []);

      const subOrderIds = subOrdersRes.map(o => o.order_id).filter(Boolean);
      let subOrderItemsMap: Record<string, any[]> = {};
      if (subOrderIds.length > 0) {
        const placeholders = subOrderIds.map(() => '?').join(',');
        const orderItemsRes = await this.databaseService.query(
          `SELECT oi.*, COALESCE(pv.name, p.name, 'Subscribed Item') as product_name, pv.name as variant_name
           FROM order_items oi
           LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
           LEFT JOIN products p ON p.product_id = pv.product_id
           WHERE oi.order_id IN (${placeholders})`,
          subOrderIds
        ).catch(() => []);

        orderItemsRes.forEach((item: any) => {
          if (!subOrderItemsMap[item.order_id]) subOrderItemsMap[item.order_id] = [];
          subOrderItemsMap[item.order_id].push(item);
        });
      }

      const formattedSubOrders = subOrdersRes.map(o => ({
        ...o,
        total_amount: Number(o.total_amount || 0),
        items: subOrderItemsMap[o.order_id] || [],
      }));

      const subOrdersDue = formattedSubOrders
        .filter(o => o.payment_status !== 'paid' && o.status !== 'cancelled')
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      const subOrdersTotalBilled = formattedSubOrders
        .filter(o => o.status !== 'cancelled')
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      const subOrdersPaid = formattedSubOrders
        .filter(o => o.payment_status === 'paid' && o.status !== 'cancelled')
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      const postpaidLimit = Number(customer.postpaid_credit_limit || 0);

      const billsRes: any[] = await this.databaseService.query(
        `SELECT * FROM customer_bills WHERE customer_id = ? ORDER BY created_at DESC`,
        [customerId]
      ).catch(() => []);

      const outstandingDue = subOrdersDue > 0
        ? subOrdersDue
        : billsRes.filter((b: any) => b.status !== 'paid' && b.status !== 'cancelled').reduce((sum: number, b: any) => sum + Number(b.due_amount || 0), 0);

      const totalCreditGiven = subOrdersTotalBilled || billsRes.reduce((sum: number, b: any) => sum + Number(b.total_amount || 0), 0);
      const totalPostpaidPaid = subOrdersPaid || billsRes.reduce((sum: number, b: any) => sum + Number(b.paid_amount || 0), 0);

      const walletTxns = await this.databaseService.query(
        `SELECT * FROM customer_wallet_transactions WHERE customer_id = ? ORDER BY created_at DESC`,
        [customerId]
      );

      const totalWalletCreditsFromTxns = walletTxns
        .filter(t => t.transaction_type === 'credit' || t.transaction_type === 'refund' || t.transaction_type === 'cashback')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const totalWalletDebits = walletTxns
        .filter(t => t.transaction_type === 'debit')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const currentWalletBalance = Number(customer.wallet_balance || 0);
      const totalWalletCredits = Math.max(totalWalletCreditsFromTxns, currentWalletBalance + totalWalletDebits);

      const subRes = await this.databaseService.query(
        `SELECT * FROM subscriptions WHERE customer_id = ? ORDER BY created_at DESC`,
        [customerId]
      );

      let activeSub: any = null;
      let subItems: any[] = [];
      if (subRes.length > 0) {
        activeSub = subRes.find((s: any) => s.status === 'active') || subRes[0];
        if (activeSub) {
          subItems = await this.databaseService.query(
            `SELECT si.*, pv.name as variant_name, p.name as product_name
             FROM subscription_items si
             LEFT JOIN product_variants pv ON pv.variant_id = si.product_variant_id
             LEFT JOIN products p ON p.product_id = pv.product_id
             WHERE si.subscription_id = ? OR si.subscription_id = ?`,
            [activeSub.subscription_id || '', activeSub.subscription_number || '']
          );
        }
      }

      const monthlyRevenueRes = await this.databaseService.query(
        `SELECT 
           to_char(created_at, 'YYYY-MM') as month,
           COUNT(*)::int as orders_count,
           SUM(total_amount)::numeric as revenue
         FROM orders
         WHERE customer_id = ? AND status::text ILIKE 'delivered'
         GROUP BY to_char(created_at, 'YYYY-MM')
         ORDER BY month ASC`,
        [customerId]
      );

      const topProductsRes = await this.databaseService.query(
        `SELECT 
           COALESCE(NULLIF(pv.name, ''), NULLIF(p.name, ''), 'Product Item') as product_name,
           SUM(oi.quantity)::numeric as total_qty,
           SUM(COALESCE(oi.final_price, oi.unit_price * oi.quantity, 0))::numeric as total_spend
         FROM order_items oi
         JOIN orders o ON o.order_id = oi.order_id
         LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
         LEFT JOIN products p ON p.product_id = pv.product_id
         WHERE o.customer_id = ? AND o.status::text ILIKE 'delivered'
         GROUP BY COALESCE(NULLIF(pv.name, ''), NULLIF(p.name, ''), 'Product Item')
         ORDER BY total_spend DESC
         LIMIT 5`,
        [customerId]
      );

      const insights: Array<{ key: string; label: string; type: 'positive' | 'warning' | 'danger' | 'info'; description: string }> = [];

      if (lifetimeRevenue > 5000) {
        insights.push({
          key: 'high_value',
          label: 'High Value Customer',
          type: 'positive',
          description: `Generated ₹${lifetimeRevenue.toFixed(2)} in total revenue across ${completedOrders.length} completed orders.`,
        });
      }

      if (completedOrders.length >= 5) {
        insights.push({
          key: 'repeat_buyer',
          label: 'High Repeat Buyer',
          type: 'positive',
          description: `Has completed ${completedOrders.length} orders with an average basket value of ₹${aov.toFixed(2)}.`,
        });
      }

      if (customer.is_postpaid_enabled) {
        insights.push({
          key: 'postpaid_active',
          label: 'Postpaid Account Enabled',
          type: 'info',
          description: `Credit limit ₹${postpaidLimit.toFixed(2)}. Outstanding due: ₹${outstandingDue.toFixed(2)}.`,
        });
      }

      if (activeSub) {
        insights.push({
          key: 'subscriber',
          label: `Active Subscriber (${activeSub.schedule_type || 'Custom'})`,
          type: 'positive',
          description: `Subscribed under #${activeSub.subscription_number}.`,
        });
      }

      if (cancelledOrders.length > 0 && formattedOrders.length > 0 && (cancelledOrders.length / formattedOrders.length) > 0.2) {
        insights.push({
          key: 'high_cancellations',
          label: 'High Cancellation Rate',
          type: 'danger',
          description: `${cancelledOrders.length} out of ${formattedOrders.length} orders cancelled (${((cancelledOrders.length / formattedOrders.length) * 100).toFixed(0)}%).`,
        });
      }

      const lastOrderDate = formattedOrders[0]?.created_at;
      if (lastOrderDate) {
        const daysDiff = (Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > 90) {
          insights.push({
            key: 'inactive_warning',
            label: 'Inactivity Warning (90+ Days)',
            type: 'warning',
            description: `Customer has not placed any order in the past ${Math.floor(daysDiff)} days.`,
          });
        }
      }

      const timelineEvents: Array<{ title: string; desc: string; date: any; icon: string; tag: string }> = [];

      timelineEvents.push({
        title: 'Customer Registered',
        desc: `Registered as ${customer.customer_type || 'regular'} customer.`,
        date: customer.created_at,
        icon: 'user-check',
        tag: 'System',
      });

      formattedOrders.slice(0, 10).forEach(o => {
        timelineEvents.push({
          title: `Order #${o.order_id}`,
          desc: `Order placed for ₹${o.total_amount} (${o.status}).`,
          date: o.created_at,
          icon: 'shopping-bag',
          tag: 'Order',
        });
      });

      walletTxns.slice(0, 10).forEach(w => {
        timelineEvents.push({
          title: `Wallet ${w.transaction_type.toUpperCase()}`,
          desc: `Amount: ₹${w.amount} | Reason: ${w.remarks || w.reference_type}`,
          date: w.created_at,
          icon: 'wallet',
          tag: 'Wallet',
        });
      });

      timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const containerBalancesRes = await this.databaseService.query(
        `SELECT ccb.*, COALESCE(cnt.name, ccb.container_id) as packaging_name, 'PCS' as packaging_unit, 0 as deposit_amount
         FROM customer_container_balances ccb
         LEFT JOIN containers cnt ON cnt.container_id = ccb.container_id AND cnt.deleted_at IS NULL
         WHERE ccb.customer_id = ? AND ccb.deleted_at IS NULL`,
        [customerId]
      ).catch(() => []);

      const packagingTypesRes = await this.databaseService.query(
        `SELECT container_id as id, name, 1 as capacity, 'PCS' as unit, is_returnable, 0 as deposit_amount 
         FROM containers 
         WHERE (status = 'active' OR status IS NULL) AND deleted_at IS NULL
         ORDER BY name ASC`
      ).catch(() => []);

      const specialPricesRes = await this.databaseService.query(
        `SELECT csp.id, csp.customer_id, csp.product_variant_id, csp.discount,
                csp.created_at, csp.updated_at,
                pv.name AS variant_name,
                COALESCE(pv.original_price, pv.price) AS original_price,
                pv.price AS selling_price,
                COALESCE(pv.subscription_price, pv.price) AS subscription_price,
                p.name AS product_name, p.product_id,
                ROUND(COALESCE(pv.subscription_price, pv.price) * (1 - (csp.discount / 100.0)), 2) AS final_subscription_price
         FROM customer_special_prices csp
         JOIN product_variants pv ON pv.variant_id = csp.product_variant_id
         JOIN products p ON p.product_id = pv.product_id
         WHERE csp.customer_id = $1 AND csp.deleted_at IS NULL
         ORDER BY p.name ASC, pv.name ASC`,
        [customerId]
      ).catch(() => []);

      const customerProfileObj = {
        id: customer.id,
        customer_id: customer.customer_id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        full_name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer',
        phone: customer.mobile || customer.phone || '',
        alternate_phone: customer.alternate_mobile || customer.alternate_phone || '',
        email: customer.email || '',
        gender: customer.gender,
        dob: customer.dob,
        profile_image: customer.profile_image,
        branch_id: customer.branch_id,
        branch_name: customer.branch_name,
        customer_status: customer.customer_status || 'active',
        customer_type: customer.customer_type || 'regular',
        wallet_balance: Number(customer.wallet_balance || 0),
        reward_points: Number(customer.reward_points || 0),
        is_postpaid_enabled: customer.is_postpaid_enabled || false,
        postpaid_credit_limit: Number(customer.postpaid_credit_limit || 0),
        is_blocked: customer.is_blocked || false,
        block_reason: customer.block_reason || '',
        subscription_number: customer.subscription_number,
        created_at: customer.created_at,
      };

      return {
        status: true,
        data: {
          customer: customerProfileObj,
          profile: customerProfileObj,
          address: addresses[0] || null,
          addresses: addresses,
          all_addresses: addresses,
          formattedOrders: formattedOrders,
          orders: formattedOrders,
          stats: {
            lifetime_revenue: lifetimeRevenue,
            lifetimeRevenue: lifetimeRevenue,
            total_orders: formattedOrders.length,
            totalOrders: formattedOrders.length,
            completed_orders: completedOrders.length,
            completedOrders: completedOrders.length,
            cancelled_orders: cancelledOrders.length,
            cancelledOrders: cancelledOrders.length,
            avg_order_value: aov,
            aov: aov,
            avgOrderValue: aov,
            max_order_value: maxOrderValue,
            maxOrderValue: maxOrderValue,
            wallet_balance: Number(customer.wallet_balance || 0),
            walletBalance: Number(customer.wallet_balance || 0),
            outstanding_due: outstandingDue,
            outstandingDue: outstandingDue,
            reward_points: Number(customer.reward_points || 0),
            rewardPoints: Number(customer.reward_points || 0),
            total_discounts_availed: totalDiscounts,
            totalDiscounts: totalDiscounts,
          },
          kpis: {
            lifetime_revenue: lifetimeRevenue,
            lifetimeRevenue: lifetimeRevenue,
            total_orders: formattedOrders.length,
            totalOrders: formattedOrders.length,
            completed_orders: completedOrders.length,
            completedOrders: completedOrders.length,
            cancelled_orders: cancelledOrders.length,
            cancelledOrders: cancelledOrders.length,
            avg_order_value: aov,
            aov: aov,
            avgOrderValue: aov,
            max_order_value: maxOrderValue,
            maxOrderValue: maxOrderValue,
            wallet_balance: Number(customer.wallet_balance || 0),
            walletBalance: Number(customer.wallet_balance || 0),
            outstanding_due: outstandingDue,
            outstandingDue: outstandingDue,
            reward_points: Number(customer.reward_points || 0),
            rewardPoints: Number(customer.reward_points || 0),
            total_discounts_availed: totalDiscounts,
            totalDiscounts: totalDiscounts,
            clv: lifetimeRevenue + Number(customer.wallet_balance || 0),
            last_order_date: formattedOrders[0]?.created_at || null,
            preferred_delivery_slot: formattedOrders[0]?.delivery_slot || 'Morning',
            preferred_payment_method: formattedOrders[0]?.payment_mode || 'UPI',
          },
          postpaid_ledger: {
            summary: {
              credit_limit: postpaidLimit,
              total_credit_given: totalCreditGiven,
              total_paid: totalPostpaidPaid,
              current_due: outstandingDue,
              credit_utilization_pct: postpaidLimit > 0 ? Math.min(100, (outstandingDue / postpaidLimit) * 100) : 0,
            },
            bills: billsRes.map(b => ({
              ...b,
              total_amount: Number(b.total_amount || 0),
              paid_amount: Number(b.paid_amount || 0),
              due_amount: Number(b.due_amount || 0),
            })),
            subscription_orders: formattedSubOrders,
          },
          wallet_ledger: {
            summary: {
              balance: Number(customer.wallet_balance || 0),
              total_credits: totalWalletCredits,
              total_debits: totalWalletDebits,
            },
            transactions: walletTxns.map(t => ({
              ...t,
              amount: Number(t.amount || 0),
              balance_after: Number(t.balance_after || 0),
            })),
          },
          subscriptions: {
            active_plan: activeSub,
            items: subItems,
            history: subRes,
          },
          container_tracking: {
            balances: containerBalancesRes.map(b => ({
              ...b,
              issued_quantity: Number(b.issued_quantity || 0),
              returned_quantity: Number(b.returned_quantity || 0),
              damaged_quantity: Number(b.damaged_quantity || 0),
              lost_quantity: Number(b.lost_quantity || 0),
              balance_quantity: Number(b.balance_quantity ?? (Number(b.issued_quantity || 0) - Number(b.returned_quantity || 0) - Number(b.damaged_quantity || 0) - Number(b.lost_quantity || 0))),
            })),
            packaging_types: packagingTypesRes,
          },
          revenue_analytics: {
            monthly_trend: monthlyRevenueRes.map(m => ({
              month: m.month,
              orders_count: Number(m.orders_count),
              revenue: Number(m.revenue),
            })),
            top_products: topProductsRes.map(p => ({
              name: p.product_name,
              product_name: p.product_name,
              total_qty: Number(p.total_qty),
              total_spend: Number(p.total_spend),
            })),
          },
          special_prices: (specialPricesRes || []).map((r: any) => {
            const originalPrice = Number(r.original_price || 0);
            const subscriptionPrice = Number(r.subscription_price || 0);
            const finalSubPrice = Number(r.final_subscription_price || 0);
            const discount = Number(r.discount || 0);
            const overallSavingsPct = originalPrice > 0
              ? parseFloat((((originalPrice - finalSubPrice) / originalPrice) * 100).toFixed(2))
              : 0;
            return {
              ...r,
              original_price: originalPrice,
              selling_price: Number(r.selling_price || 0),
              subscription_price: subscriptionPrice,
              discount: discount,
              final_subscription_price: finalSubPrice,
              overall_savings_pct: overallSavingsPct,
            };
          }),
          smart_insights: insights,
          activity_timeline: timelineEvents,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('CustomersService.getCustomerPortfolio error', { error, id });
      throw new InternalServerErrorException('Failed to fetch customer portfolio');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CUSTOMER DIRECTORY TABLE
  // ═══════════════════════════════════════════════════════════════

  async getCustomerTable(query: any) {
    try {
      const columns: Record<string, [string, boolean]> = {
        id: ['customers.customer_id', false],
        customer_name: ["CONCAT_WS(' ', users.first_name, users.last_name)", true],
        phone: ['users.phone', true],
        email: ['users.email', true],
        joined: ['customers.created_at', true],
        wallet_balance: ['customers.wallet_balance', true],
        status: ['customers.customer_status', true],
      };

      const joins: JoinDef[] = [
        {
          type: 'left',
          table: 'users',
          on: [['customers.customer_id', 'users.user_id']],
        },
      ];

      const conditions: any[] = [];

      if (query.status) {
        conditions.push({
          column: 'customers.customer_status',
          operator: '=',
          value: query.status,
        });
      }

      const custom: CustomDef[] = [
        {
          type: 'modify',
          column: 'status',
          view:
            '::IF(status = active, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">Active</span>)::' +
            'ELSEIF(status = dormant, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Dormant</span>)::' +
            'ELSEIF(status = paused, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">Paused</span>)::' +
            'ELSEIF(status = blocked, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">Blocked</span>)::' +
            'ELSE(<span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">New</span>)::',
          renderHtml: true,
        },
        {
          type: 'addon',
          column: 'actions',
          view: '<a class="px-3 py-1 text-xs font-medium rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer">View</a>',
          renderHtml: true,
        },
      ];

      const reqSet: ReqSet = {
        key: 'customers',
        table: 'customers',
        filters: {
          search: query.search || '',
          dateRange: {},
          columns: {},
          sort: query.sortBy ? { [query.sortBy]: query.sortDir || 'ASC' } : {},
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns,
        joins,
        conditions,
        custom,
        req_set: reqSet,
      };
      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('CustomersService.getCustomerTable error', {
        error,
      });
      throw new InternalServerErrorException(
        'Failed to retrieve customer table',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CUSTOMER SEGMENTATION
  // ═══════════════════════════════════════════════════════════════

  async getSegments() {
    try {
      const active = await this.dataService.query('customers', {
        select: { count: true },
        where: [
          {
            column: 'customers.customer_status',
            operator: '=',
            value: 'active',
          },
        ],
      });
      const dormant = await this.dataService.query('customers', {
        select: { count: true },
        where: [
          {
            column: 'customers.customer_status',
            operator: '=',
            value: 'dormant',
          },
        ],
      });
      const paused = await this.dataService.query('customers', {
        select: { count: true },
        where: [
          {
            column: 'customers.customer_status',
            operator: '=',
            value: 'paused',
          },
        ],
      });
      const blocked = await this.dataService.query('customers', {
        select: { count: true },
        where: [
          { column: 'customers.customer_status', operator: '=', value: 'blocked' },
        ],
      });

      return {
        status: true,
        data: {
          active: active?.data?.[0]?.count ?? 0,
          dormant: dormant?.data?.[0]?.count ?? 0,
          paused: paused?.data?.[0]?.count ?? 0,
          blocked: blocked?.data?.[0]?.count ?? 0,
        },
      };
    } catch (error) {
      this.developer.error('CustomersService.getSegments error', { error });
      throw new InternalServerErrorException('Failed to retrieve segments');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SINGLE CUSTOMER PROFILE
  // ═══════════════════════════════════════════════════════════════

  async getCustomerProfile(id: string) {
    try {
      const result = await this.dataService.query('customers', {
        select: [
          'customers.*',
          'users.first_name',
          'users.last_name',
          'users.email',
          'users.phone',
          'users.created_at AS user_created_at',
        ],
        joins: [
          {
            type: 'left',
            table: 'users',
            on: [['customers.customer_id', 'users.user_id']],
          },
        ],
        where: [{ column: 'customers.customer_id', operator: '=', value: id }],
        limit: 1,
      });

      if (!result?.data?.length) {
        throw new BadRequestException('Customer not found');
      }

      return { status: true, data: result.data[0] };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('CustomersService.getCustomerProfile error', {
        error,
        id,
      });
      throw new InternalServerErrorException(
        'Failed to retrieve customer profile',
      );
    }
  }

  async getCustomerOrders(id: string, query: any) {
    try {
      const columns: Record<string, [string, boolean]> = {
        order_id: ['orders.id', true],
        product: ['order_items.product_name', true],
        amount: ['orders.total_amount', true],
        status: ['orders.status', true],
        delivery_date: ['orders.delivery_date', true],
        created_at: ['orders.created_at', true],
      };

      const joins: JoinDef[] = [
        {
          type: 'left',
          table: 'order_items',
          on: [['orders.id', 'order_items.order_id']],
        },
      ];

      const conditions = [
        { column: 'orders.customer_id', operator: '=', value: id },
      ];

      const custom: CustomDef[] = [
        {
          type: 'modify',
          column: 'status',
          view:
            '::IF(status = delivered, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">Delivered</span>)::' +
            'ELSEIF(status = pending, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">Pending</span>)::' +
            'ELSEIF(status = failed, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">Failed</span>)::' +
            'ELSE(<span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">Processing</span>)::',
          renderHtml: true,
        },
      ];

      const reqSet: ReqSet = {
        key: 'customer_orders',
        table: 'orders',
        filters: {
          search: '',
          dateRange: {},
          columns: {},
          sort: { 'orders.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns,
        joins,
        conditions,
        custom,
        req_set: reqSet,
      };
      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('CustomersService.getCustomerOrders error', {
        error,
        id,
      });
      throw new InternalServerErrorException(
        'Failed to retrieve customer orders',
      );
    }
  }

  async getWalletLedger(id: string, query: any) {
    try {
      const columns: Record<string, [string, boolean]> = {
        txn_id: ['wallet_transactions.id', true],
        type: ['wallet_transactions.type', true],
        amount: ['wallet_transactions.amount', true],
        reason: ['wallet_transactions.reason', true],
        initiated_by: ['wallet_transactions.initiated_by', true],
        created_at: ['wallet_transactions.created_at', true],
      };

      const conditions = [
        { column: 'wallet_transactions.customer_id', operator: '=', value: id },
      ];

      const custom: CustomDef[] = [
        {
          type: 'modify',
          column: 'type',
          view:
            '::IF(type = credit, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">+ Credit</span>)::' +
            'ELSEIF(type = debit, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">− Debit</span>)::' +
            'ELSE(<span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">System</span>)::',
          renderHtml: true,
        },
      ];

      const reqSet: ReqSet = {
        key: 'customer_wallet',
        table: 'customer_wallet_transactions',
        filters: {
          search: '',
          dateRange: {},
          columns: {},
          sort: { 'wallet_transactions.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns,
        joins: [],
        conditions,
        custom,
        req_set: reqSet,
      };
      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('CustomersService.getWalletLedger error', {
        error,
        id,
      });
      throw new InternalServerErrorException(
        'Failed to retrieve wallet ledger',
      );
    }
  }

  async getComplaints(id: string, query: any) {
    try {
      const columns: Record<string, [string, boolean]> = {
        complaint_id: ['complaints.id', true],
        subject: ['complaints.subject', true],
        description: ['complaints.description', true],
        status: ['complaints.status', true],
        priority: ['complaints.priority', true],
        created_at: ['complaints.created_at', true],
      };

      const conditions = [
        { column: 'complaints.customer_id', operator: '=', value: id },
      ];

      const custom: CustomDef[] = [
        {
          type: 'modify',
          column: 'status',
          view:
            '::IF(status = open, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">Open</span>)::' +
            'ELSEIF(status = resolved, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">Resolved</span>)::' +
            'ELSEIF(status = rejected, <span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">Rejected</span>)::' +
            'ELSE(<span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">Under Review</span>)::',
          renderHtml: true,
        },
      ];

      const reqSet: ReqSet = {
        key: 'customer_complaints',
        table: 'complaints',
        filters: {
          search: '',
          dateRange: {},
          columns: {},
          sort: { 'complaints.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns,
        joins: [],
        conditions,
        custom,
        req_set: reqSet,
      };
      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('CustomersService.getComplaints error', {
        error,
        id,
      });
      throw new InternalServerErrorException('Failed to retrieve complaints');
    }
  }

  async getCustomerScore(id: string) {
    try {
      const profile = await this.dataService.query('customers', {
        select: [
          'customers.fraud_score',
          'customers.loyalty_points',
          'customers.credit_limit',
        ],
        where: [{ column: 'customers.id', operator: '=', value: id }],
        limit: 1,
      });

      return {
        status: true,
        data: profile?.data?.[0] ?? {
          fraud_score: 0,
          loyalty_points: 0,
          credit_limit: 0,
        },
      };
    } catch (error) {
      this.developer.error('CustomersService.getCustomerScore error', {
        error,
        id,
      });
      throw new InternalServerErrorException(
        'Failed to retrieve customer score',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // WALLET ACTIONS & ACCOUNT CONTROLS
  // ═══════════════════════════════════════════════════════════════

  async creditWallet(
    customerId: string,
    amount: number,
    reason: string,
    adminId: string,
  ) {
    if (!amount || amount <= 0)
      throw new BadRequestException('Amount must be positive');
    if (!reason) throw new BadRequestException('Reason is required');

    try {
      const custRes = await this.databaseService.query(
        `SELECT customer_id, wallet_balance FROM customers WHERE customer_id = ? OR id::text = ?`,
        [customerId, customerId]
      );
      if (!custRes || custRes.length === 0) {
        throw new BadRequestException('Customer not found');
      }
      const actualCustId = custRes[0].customer_id;
      const currentBalance = Number(custRes[0].wallet_balance || 0);
      const newBalance = currentBalance + Number(amount);

      await this.databaseService.query(
        `UPDATE customers SET wallet_balance = ?, updated_at = NOW() WHERE customer_id = ?`,
        [newBalance, actualCustId]
      );

      await this.databaseService.query(
        `INSERT INTO customer_wallet_transactions (customer_id, transaction_type, amount, balance_after, reference_type, remarks, created_by)
         VALUES (?, 'credit', ?, ?, 'manual', ?, ?)`,
        [actualCustId, amount, newBalance, reason, adminId]
      );

      return { status: true, message: `₹${amount} credited successfully`, newBalance };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('CustomersService.creditWallet error', {
        error,
        customerId,
      });
      throw new InternalServerErrorException('Failed to credit wallet');
    }
  }

  async debitWallet(
    customerId: string,
    amount: number,
    reason: string,
    adminId: string,
  ) {
    if (!amount || amount <= 0)
      throw new BadRequestException('Amount must be positive');
    if (!reason) throw new BadRequestException('Reason is required');

    try {
      const custRes = await this.databaseService.query(
        `SELECT customer_id, wallet_balance FROM customers WHERE customer_id = ? OR id::text = ?`,
        [customerId, customerId]
      );
      if (!custRes || custRes.length === 0) {
        throw new BadRequestException('Customer not found');
      }
      const actualCustId = custRes[0].customer_id;
      const currentBalance = Number(custRes[0].wallet_balance || 0);
      const newBalance = currentBalance - Number(amount);

      await this.databaseService.query(
        `UPDATE customers SET wallet_balance = ?, updated_at = NOW() WHERE customer_id = ?`,
        [newBalance, actualCustId]
      );

      await this.databaseService.query(
        `INSERT INTO customer_wallet_transactions (customer_id, transaction_type, amount, balance_after, reference_type, remarks, created_by)
         VALUES (?, 'debit', ?, ?, 'manual', ?, ?)`,
        [actualCustId, amount, newBalance, reason, adminId]
      );

      return { status: true, message: `₹${amount} debited successfully`, newBalance };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('CustomersService.debitWallet error', {
        error,
        customerId,
      });
      throw new InternalServerErrorException('Failed to debit wallet');
    }
  }

  async freezeWallet(customerId: string, adminId: string) {
    try {
      await this.databaseService.query(
        `UPDATE customers SET customer_status = 'paused', updated_at = NOW() WHERE customer_id = ? OR id::text = ?`,
        [customerId, customerId]
      );

      return { status: true, message: 'Wallet/Account paused successfully' };
    } catch (error) {
      this.developer.error('CustomersService.freezeWallet error', {
        error,
        customerId,
      });
      throw new InternalServerErrorException('Failed to freeze wallet');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // COMPLAINT RESOLUTION
  // ═══════════════════════════════════════════════════════════════

  async approveRefund(
    customerId: string,
    complaintId: string,
    adminId: string,
  ) {
    try {
      const complaint = await this.dataService.query('complaints', {
        select: ['complaints.refund_amount'],
        where: [{ column: 'complaints.id', operator: '=', value: complaintId }],
        limit: 1,
      });

      const refundAmount = complaint?.data?.[0]?.refund_amount ?? 0;

      await this.dataService.query('complaints', {
        update: {
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: adminId,
        },
        where: [{ column: 'complaints.id', operator: '=', value: complaintId }],
      });

      if (refundAmount > 0) {
        await this.creditWallet(
          customerId,
          refundAmount,
          `Refund for complaint #${complaintId}`,
          adminId,
        );
      }

      return {
        status: true,
        message: 'Refund approved and credited to wallet',
      };
    } catch (error) {
      this.developer.error('CustomersService.approveRefund error', { error });
      throw new InternalServerErrorException('Failed to approve refund');
    }
  }

  async rejectComplaint(
    customerId: string,
    complaintId: string,
    reason: string,
    adminId: string,
  ) {
    if (!reason) throw new BadRequestException('Rejection reason is required');

    try {
      await this.dataService.query('complaints', {
        update: {
          status: 'rejected',
          rejection_reason: reason,
          resolved_at: new Date().toISOString(),
          resolved_by: adminId,
        },
        where: [{ column: 'complaints.id', operator: '=', value: complaintId }],
      });

      return { status: true, message: 'Complaint rejected' };
    } catch (error) {
      this.developer.error('CustomersService.rejectComplaint error', { error });
      throw new InternalServerErrorException('Failed to reject complaint');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ACCOUNT CONTROLS
  // ═══════════════════════════════════════════════════════════════

  async blockCustomer(customerId: string, reason: string, adminId: string) {
    if (!reason) throw new BadRequestException('Block reason is required');

    try {
      await this.databaseService.query(
        `UPDATE customers SET is_blocked = true, block_reason = ?, customer_status = 'blocked', updated_at = NOW()
         WHERE customer_id = ? OR id::text = ?`,
        [reason, customerId, customerId]
      );

      return { status: true, message: 'Customer blocked successfully' };
    } catch (error) {
      this.developer.error('CustomersService.blockCustomer error', { error });
      throw new InternalServerErrorException('Failed to block customer');
    }
  }

  async unblockCustomer(customerId: string, adminId: string) {
    try {
      await this.databaseService.query(
        `UPDATE customers SET is_blocked = false, block_reason = NULL, customer_status = 'active', updated_at = NOW()
         WHERE customer_id = ? OR id::text = ?`,
        [customerId, customerId]
      );

      return { status: true, message: 'Customer unblocked successfully' };
    } catch (error) {
      this.developer.error('CustomersService.unblockCustomer error', { error });
      throw new InternalServerErrorException('Failed to unblock customer');
    }
  }

  async setPostpaidLimit(customerId: string, limit: number, adminId: string) {
    if (limit === undefined || limit < 0)
      throw new BadRequestException('Invalid credit limit');

    try {
      const isEnabled = limit > 0;
      await this.databaseService.query(
        `UPDATE customers SET postpaid_credit_limit = ?, is_postpaid_enabled = ?, updated_at = NOW()
         WHERE customer_id = ? OR id::text = ?`,
        [limit, isEnabled, customerId, customerId]
      );

      return { status: true, message: `Postpaid credit limit set to ₹${limit}` };
    } catch (error) {
      this.developer.error('CustomersService.setPostpaidLimit error', {
        error,
      });
      throw new InternalServerErrorException('Failed to set postpaid limit');
    }
  }

  async sendNotification(
    customerId: string,
    message: string,
    type: string = 'push',
  ) {
    if (!message) throw new BadRequestException('Message is required');

    try {
      await this.dataService.insert('notifications', {
        recipient_type: 'customer',
        recipient_id: customerId,
        type,
        message,
        status: 'pending',
        created_by: 'system',
        updated_by: 'system',
      });

      return { status: true, message: 'Notification queued successfully' };
    } catch (error) {
      this.developer.error('CustomersService.sendNotification error', {
        error,
      });
      throw new InternalServerErrorException('Failed to send notification');
    }
  }

  async exportCustomerData(customerId: string) {
    try {
      const profile = await this.getCustomerProfile(customerId);
      const orders = await this.dataService.query('orders', {
        select: ['*'],
        where: [
          { column: 'orders.customer_id', operator: '=', value: customerId },
        ],
      });
      const walletTxns = await this.dataService.query('customer_wallet_transactions', {
        select: ['*'],
        where: [
          {
            column: 'wallet_transactions.customer_id',
            operator: '=',
            value: customerId,
          },
        ],
      });

      return {
        status: true,
        data: {
          profile: profile.data,
          orders: orders?.data ?? [],
          wallet_transactions: walletTxns?.data ?? [],
        },
      };
    } catch (error) {
      this.developer.error('CustomersService.exportCustomerData error', {
        error,
      });
      throw new InternalServerErrorException('Failed to export customer data');
    }
  }

  async deleteAccount(customerId: string, adminId: string) {
    try {
      await this.dataService.query('customers', {
        update: {
          status: 'deleted',
          deleted_at: new Date().toISOString(),
        },
        where: [{ column: 'customers.id', operator: '=', value: customerId }],
      });

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'account_delete_dpdpa',
        target_type: 'customer',
        target_id: customerId,
        details: JSON.stringify({ action: 'DPDPA account deletion' }),
      });

      return {
        status: true,
        message: 'Account deletion initiated (DPDPA compliance)',
      };
    } catch (error) {
      this.developer.error('CustomersService.deleteAccount error', { error });
      throw new InternalServerErrorException('Failed to delete account');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // VIEW & SOFT DELETE (for table actions)
  // ═══════════════════════════════════════════════════════════════

  async getCustomerView(id: string) {
    try {
      const result = await this.dataService.query('customers', {
        select: ['customers.*'],
        where: [
          { column: 'customers.id', operator: '=', value: id },
          { column: 'customers.deleted_at', operator: 'IS', value: null },
        ],
        limit: 1,
      });

      if (!result?.data?.length) {
        return { status: false, message: 'Customer not found' };
      }

      return { status: true, data: result.data[0] };
    } catch (error) {
      this.developer.error('getCustomerView error', { error, id });
      throw new InternalServerErrorException('Failed to load customer details');
    }
  }

  async softDeleteCustomer(id: string, adminId: string = 'system') {
    try {
      const result = await this.dataService.query('customers', {
        update: { deleted_at: new Date().toISOString() },
        where: [
          { column: 'id', operator: '=', value: id },
          { column: 'deleted_at', operator: 'IS', value: null },
        ],
      });

      if (!result?.status) {
        return {
          status: false,
          message: 'Customer not found or already deleted',
        };
      }

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'customer_soft_delete',
        target_type: 'customers',
        target_id: id,
        details: JSON.stringify({ action: 'soft_delete' }),
      });

      return { status: true, message: 'Customer deleted successfully' };
    } catch (error) {
      this.developer.error('softDeleteCustomer error', { error, id });
      throw new InternalServerErrorException('Failed to delete customer');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // WALLET TRANSACTIONS VIEW & SOFT DELETE
  // ═══════════════════════════════════════════════════════════════

  async getWalletTransactionView(id: string) {
    try {
      const result = await this.dataService.query('customer_wallet_transactions', {
        select: ['wallet_transactions.*'],
        where: [
          { column: 'wallet_transactions.id', operator: '=', value: id },
          {
            column: 'wallet_transactions.deleted_at',
            operator: 'IS',
            value: null,
          },
        ],
        limit: 1,
      });

      if (!result?.data?.length) {
        return { status: false, message: 'Wallet transaction not found' };
      }

      return { status: true, data: result.data[0] };
    } catch (error) {
      this.developer.error('getWalletTransactionView error', { error, id });
      throw new InternalServerErrorException(
        'Failed to load wallet transaction details',
      );
    }
  }

  async softDeleteWalletTransaction(id: string, adminId: string = 'system') {
    try {
      const result = await this.dataService.query('customer_wallet_transactions', {
        update: { deleted_at: new Date().toISOString() },
        where: [
          { column: 'id', operator: '=', value: id },
          { column: 'deleted_at', operator: 'IS', value: null },
        ],
      });

      if (!result?.status) {
        return {
          status: false,
          message: 'Wallet transaction not found or already deleted',
        };
      }

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'wallet_transactions_soft_delete',
        target_type: 'customer_wallet_transactions',
        target_id: id,
        details: JSON.stringify({ action: 'soft_delete' }),
      });

      return {
        status: true,
        message: 'Wallet transaction deleted successfully',
      };
    } catch (error) {
      this.developer.error('softDeleteWalletTransaction error', { error, id });
      throw new InternalServerErrorException(
        'Failed to delete wallet transaction',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CONTAINER & RETURN TRACKING LOGGING
  // ═══════════════════════════════════════════════════════════════

  async logContainerTransaction(id: string, body: any, adminId: string = 'system') {
    try {
      const custRes = await this.databaseService.query(
        `SELECT customer_id FROM customers WHERE customer_id = ? OR id::text = ?`,
        [id, id]
      );
      if (!custRes || custRes.length === 0) {
        throw new BadRequestException('Customer not found');
      }
      const customerId = custRes[0].customer_id;

      const { packaging_type_id, transaction_type, quantity } = body;
      const qty = Math.abs(Number(quantity || 0));
      if (!packaging_type_id || !transaction_type || qty <= 0) {
        throw new BadRequestException('Packaging type, valid transaction type, and quantity > 0 are required');
      }

      const issueAdd = transaction_type === 'issue' ? qty : 0;
      const returnAdd = transaction_type === 'return' ? qty : 0;
      const damagedAdd = transaction_type === 'damaged' ? qty : 0;
      const lostAdd = transaction_type === 'lost' ? qty : 0;

      // Only the running balance is kept now; there is no per-transaction
      // ledger table. (customer_id, container_id) is unique, so this upserts.
      await this.databaseService.query(
        `INSERT INTO customer_container_balances 
         (customer_id, container_id, issued_quantity, returned_quantity, damaged_quantity, lost_quantity)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (customer_id, container_id) DO UPDATE SET
           issued_quantity   = customer_container_balances.issued_quantity + EXCLUDED.issued_quantity,
           returned_quantity = customer_container_balances.returned_quantity + EXCLUDED.returned_quantity,
           damaged_quantity  = customer_container_balances.damaged_quantity + EXCLUDED.damaged_quantity,
           lost_quantity     = customer_container_balances.lost_quantity + EXCLUDED.lost_quantity,
           updated_at = NOW()`,
        [customerId, packaging_type_id, issueAdd, returnAdd, damagedAdd, lostAdd]
      );

      return { status: true, message: 'Container transaction logged successfully' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('logContainerTransaction error', { error, id });
      throw new InternalServerErrorException('Failed to log container transaction');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SETTLE POSTPAID BILL
  // ═══════════════════════════════════════════════════════════════

  async settlePostpaidBill(id: string, body: any, adminId: string = 'system') {
    try {
      const custRes = await this.databaseService.query(
        `SELECT customer_id, first_name, last_name, phone FROM customers WHERE customer_id = ? OR id::text = ?`,
        [id, id]
      );
      if (!custRes || custRes.length === 0) {
        throw new BadRequestException('Customer not found');
      }
      const customer = custRes[0];
      const customerId = customer.customer_id;
      const { amount, payment_mode = 'CASH', notes = '' } = body;

      const numAmount = Number(amount || 0);
      if (numAmount <= 0) {
        throw new BadRequestException('Settle amount must be greater than 0');
      }

      // Update all pending/unpaid postpaid orders for this customer to PAID
      await this.databaseService.query(
        `UPDATE orders
         SET payment_status = 'paid', updated_at = NOW()
         WHERE customer_id = ?
           AND payment_mode = 'POSTPAID'
           AND payment_status != 'paid'`,
        [customerId]
      );

      // Record in customer_bills if table exists
      await this.databaseService.query(
        `UPDATE customer_bills
         SET status = 'paid', paid_amount = total_amount, due_amount = 0, updated_at = NOW()
         WHERE customer_id = ? AND status != 'paid'`,
        [customerId]
      ).catch(() => []);

      // Log admin audit
      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'settle_postpaid_bill',
        target_type: 'customers',
        target_id: customerId,
        details: JSON.stringify({ amount: numAmount, payment_mode, notes }),
      }).catch(() => []);

      return {
        status: true,
        message: `Postpaid bill of ₹${numAmount.toLocaleString('en-IN')} for ${customer.first_name || 'Customer'} successfully settled!`,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('settlePostpaidBill error', { error, id });
      throw new InternalServerErrorException('Failed to settle postpaid bill');
    }
  }

  // ─── SPECIAL PRICES ────────────────────────────────────────────

  async getProductsList() {
    try {
      const rows = await this.databaseService.query(
        `SELECT product_id, name, unit_type, is_active
         FROM products
         WHERE deleted_at IS NULL AND is_active = true
         ORDER BY name ASC`,
        [],
      );
      return { status: true, data: rows };
    } catch (error) {
      this.developer.error('getProductsList error', { error });
      throw new InternalServerErrorException('Failed to fetch products');
    }
  }

  async getProductVariants(productId: string) {
    try {
      const rows = await this.databaseService.query(
        `SELECT variant_id, product_id, name, price, subscription_price,
                original_price, discount, unit_value, unit_type, status
         FROM product_variants
         WHERE product_id = $1 AND deleted_at IS NULL AND status = 'active'
         ORDER BY sort_order ASC, name ASC`,
        [productId],
      );
      return { status: true, data: rows };
    } catch (error) {
      this.developer.error('getProductVariants error', { error });
      throw new InternalServerErrorException('Failed to fetch product variants');
    }
  }

  async getSpecialPrices(customerId: string) {
    try {
      const rows = await this.databaseService.query(
        `SELECT csp.id, csp.customer_id, csp.product_variant_id, csp.discount,
                csp.created_at, csp.updated_at,
                pv.name AS variant_name,
                COALESCE(pv.original_price, pv.price) AS original_price,
                pv.price AS selling_price,
                COALESCE(pv.subscription_price, pv.price) AS subscription_price,
                p.name AS product_name, p.product_id,
                ROUND(COALESCE(pv.subscription_price, pv.price) * (1 - (csp.discount / 100.0)), 2) AS final_subscription_price
         FROM customer_special_prices csp
         JOIN product_variants pv ON pv.variant_id = csp.product_variant_id
         JOIN products p ON p.product_id = pv.product_id
         WHERE csp.customer_id = $1 AND csp.deleted_at IS NULL
         ORDER BY p.name ASC, pv.name ASC`,
        [customerId],
      );
      return {
        status: true,
        data: rows.map((r: any) => {
          const subPrice = Number(r.subscription_price || 0);
          const finalSubPrice = Number(r.final_subscription_price || 0);
          const originalPrice = Number(r.original_price || 0);
          const discount = Number(r.discount || 0);
          const overallSavingsPct = originalPrice > 0
            ? parseFloat(((( originalPrice - finalSubPrice) / originalPrice) * 100).toFixed(2))
            : 0;
          return {
            ...r,
            original_price: originalPrice,
            selling_price: Number(r.selling_price || 0),
            subscription_price: subPrice,
            discount: discount,
            final_subscription_price: finalSubPrice,
            overall_savings_pct: overallSavingsPct,
          };
        }),
      };
    } catch (error) {
      this.developer.error('getSpecialPrices error', { error });
      throw new InternalServerErrorException('Failed to fetch special prices');
    }
  }


  async saveSpecialPrices(
    customerId: string,
    items: Array<{ product_variant_id: string; final_subscription_price?: number; discount?: number; variant_id?: string }>,
    adminId: string,
  ) {
    try {
      if (!items || items.length === 0) {
        throw new BadRequestException('No items provided');
      }
      for (const item of items) {
        const variantId = item.product_variant_id || item.variant_id;
        if (!variantId) {
          throw new BadRequestException('Product variant ID is required');
        }

        // Fetch the current subscription_price and selling price for this variant
        const variantRows = await this.databaseService.query(
          `SELECT COALESCE(subscription_price, price) AS subscription_price, price, original_price 
           FROM product_variants WHERE variant_id = $1`,
          [variantId],
        );
        if (!variantRows || variantRows.length === 0) {
          throw new BadRequestException(`Variant not found: ${variantId}`);
        }
        const subscriptionPrice = Number(variantRows[0].subscription_price || variantRows[0].price || 0);

        let discount: number;

        if (item.final_subscription_price !== undefined && item.final_subscription_price !== null) {
          const finalPrice = Number(item.final_subscription_price);

          if (finalPrice < 0) {
            throw new BadRequestException(`Final subscription price cannot be negative`);
          }
          if (finalPrice > subscriptionPrice && subscriptionPrice > 0) {
            throw new BadRequestException(
              `Final subscription price (₹${finalPrice}) cannot exceed subscription price (₹${subscriptionPrice})`,
            );
          }

          if (finalPrice === subscriptionPrice) {
            discount = 0;
          } else if (finalPrice === 0) {
            discount = 100;
          } else {
            // Formula: ((subscription_price - final_subscription_price) / subscription_price) * 100
            discount = subscriptionPrice > 0
              ? parseFloat((((subscriptionPrice - finalPrice) / subscriptionPrice) * 100).toFixed(2))
              : 0;
          }
        } else {
          // Legacy: direct discount percentage provided
          discount = Number(item.discount ?? 0);
        }

        if (discount < 0 || discount > 100) {
          throw new BadRequestException(`Calculated discount out of range: ${discount}`);
        }

        const calculatedFinalPrice = subscriptionPrice > 0
          ? parseFloat((subscriptionPrice * (1 - (discount / 100.0))).toFixed(2))
          : 0;

        // Upsert: store discount_percentage as single source of truth
        await this.databaseService.query(
          `INSERT INTO customer_special_prices (customer_id, product_variant_id, discount, discount_percentage, special_price, created_at, updated_at)
           VALUES ($1, $2, $3, $3, $4, NOW(), NOW())
           ON CONFLICT (customer_id, product_variant_id)
           DO UPDATE SET discount = EXCLUDED.discount,
                         discount_percentage = EXCLUDED.discount_percentage,
                         special_price = EXCLUDED.special_price,
                         updated_at = NOW(),
                         deleted_at = NULL`,
          [customerId, variantId, discount, calculatedFinalPrice],
        );
      }
      return { status: true, message: `Special prices saved for ${items.length} variant(s)` };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('saveSpecialPrices error', { error, customerId });
      throw new InternalServerErrorException('Failed to save special prices');
    }
  }

  async deleteSpecialPrice(customerId: string, variantId: string) {
    try {
      await this.databaseService.query(
        `UPDATE customer_special_prices SET deleted_at = NOW()
         WHERE customer_id = $1 AND product_variant_id = $2`,
        [customerId, variantId],
      );
      return { status: true, message: 'Special price removed' };
    } catch (error) {
      this.developer.error('deleteSpecialPrice error', { error });
      throw new InternalServerErrorException('Failed to delete special price');
    }
  }

  async getSpecialPricesTable(query: any) {
    try {
      const search = query?.search?.trim() || '';
      const params: any[] = [];
      const whereClauses: string[] = ['csp.deleted_at IS NULL'];

      if (search) {
        params.push(`%${search}%`);
        const pIdx = params.length;
        whereClauses.push(`(
          csp.customer_id ILIKE $${pIdx} OR 
          COALESCE(u.first_name, '') ILIKE $${pIdx} OR 
          COALESCE(u.last_name, '') ILIKE $${pIdx} OR 
          COALESCE((COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') ILIKE $${pIdx} OR 
          COALESCE(u.email, '') ILIKE $${pIdx} OR 
          COALESCE(u.phone, '') ILIKE $${pIdx} OR 
          p.name ILIKE $${pIdx} OR 
          pv.name ILIKE $${pIdx}
        )`);
      }

      const sql = `
        SELECT 
          csp.id,
          csp.customer_id,
          COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.user_name, u.email, u.phone, csp.customer_id) AS customer_name,
          COALESCE(u.email, '') AS customer_email,
          COALESCE(u.phone, '') AS customer_phone,
          csp.product_variant_id,
          pv.name AS variant_name,
          pv.product_id,
          p.name AS product_name,
          COALESCE(pv.original_price, pv.price) AS original_price,
          pv.price AS selling_price,
          COALESCE(pv.subscription_price, pv.price) AS subscription_price,
          COALESCE(csp.discount_percentage, csp.discount, 0) AS discount,
          ROUND(COALESCE(pv.subscription_price, pv.price) * (1 - (COALESCE(csp.discount_percentage, csp.discount, 0) / 100.0)), 2) AS final_subscription_price,
          csp.created_at,
          csp.updated_at
        FROM customer_special_prices csp
        JOIN users u ON u.user_id = csp.customer_id
        JOIN product_variants pv ON pv.variant_id = csp.product_variant_id
        JOIN products p ON p.product_id = pv.product_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY csp.created_at DESC
      `;

      const rows = await this.databaseService.query(sql, params);

      const totalRules = rows.length;
      const uniqueCustomers = new Set(rows.map((r: any) => r.customer_id)).size;
      const avgDiscount = totalRules > 0
        ? (rows.reduce((acc: number, r: any) => acc + Number(r.discount || 0), 0) / totalRules).toFixed(1)
        : '0';

      return {
        status: true,
        summary: {
          total_rules: totalRules,
          unique_customers: uniqueCustomers,
          avg_discount: avgDiscount,
        },
        data: rows.map((r: any) => {
          const originalPrice = Number(r.original_price || 0);
          const subscriptionPrice = Number(r.subscription_price || 0);
          const finalSubPrice = Number(r.final_subscription_price || 0);
          const discount = Number(r.discount || 0);
          const overallSavingsPct = originalPrice > 0
            ? parseFloat((((originalPrice - finalSubPrice) / originalPrice) * 100).toFixed(2))
            : 0;
          return {
            id: r.id,
            customer_id: r.customer_id,
            customer_name: r.customer_name || 'Customer',
            customer_email: r.customer_email,
            customer_phone: r.customer_phone,
            product_id: r.product_id,
            product_name: r.product_name,
            product_variant_id: r.product_variant_id,
            variant_name: r.variant_name,
            original_price: originalPrice,
            selling_price: Number(r.selling_price || 0),
            subscription_price: subscriptionPrice,
            discount: discount,
            final_subscription_price: finalSubPrice,
            overall_savings_pct: overallSavingsPct,
            created_at: r.created_at,
            updated_at: r.updated_at,
          };
        }),
      };
    } catch (error) {
      this.developer.error('getSpecialPricesTable error', { error });
      throw new InternalServerErrorException('Failed to fetch special prices table');
    }
  }

  async getSpecialPricesOptions() {
    try {
      const customers = await this.databaseService.query(`
        SELECT 
          u.user_id AS id, 
          COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.user_name, u.email, u.phone, u.user_id) AS name,
          COALESCE(u.email, '') AS email,
          COALESCE(u.phone, '') AS phone
        FROM users u
        JOIN customers c ON c.customer_id = u.user_id
        WHERE u.deleted_at IS NULL
        ORDER BY u.first_name ASC, u.created_at DESC
        LIMIT 500
      `);


      const variants = await this.databaseService.query(`
        SELECT 
          pv.variant_id AS id,
          p.name AS product_name,
          pv.name AS variant_name,
          (p.name || ' (' || pv.name || ')') AS full_name,
          pv.price AS selling_price,
          COALESCE(pv.original_price, pv.price) AS actual_price
        FROM product_variants pv
        JOIN products p ON p.product_id = pv.product_id
        WHERE pv.deleted_at IS NULL AND p.deleted_at IS NULL
        ORDER BY p.name ASC, pv.name ASC
      `);

      return {
        status: true,
        customers,
        variants: variants.map((v: any) => ({
          ...v,
          selling_price: Number(v.selling_price || 0),
          actual_price: Number(v.actual_price || 0),
        })),
      };
    } catch (error) {
      this.developer.error('getSpecialPricesOptions error', { error });
      throw new InternalServerErrorException('Failed to fetch special prices options');
    }
  }

  async deleteSpecialPriceById(id: string) {
    try {
      await this.databaseService.query(
        `UPDATE customer_special_prices SET deleted_at = NOW() WHERE id = $1`,
        [id],
      );
      return { status: true, message: 'Special price rule deleted' };
    } catch (error) {
      this.developer.error('deleteSpecialPriceById error', { error });
      throw new InternalServerErrorException('Failed to delete special price rule');
    }
  }
}

