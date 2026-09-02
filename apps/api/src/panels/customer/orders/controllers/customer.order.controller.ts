import { Body, Controller, Get, Post, UseGuards, Req, BadRequestException, Param,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { DataService } from 'src/shared/database/Data.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { RedisService } from 'src/shared/redis/redis.service';

@Controller({ path: 'customer/orders', version: '1' })
@UseGuards(AuthGuard('jwt'))
export class CustomerOrderController {
  private readonly logger = new Logger(CustomerOrderController.name);

  constructor(
    private readonly data: DataService,
    private readonly db: DatabaseService,
    private readonly redisService: RedisService,
  ) { }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /customer/orders
  // Returns both one-time orders and subscription orders (split by order_source)
  // PLUS the customer's subscription plans — all in one optimised response.
  //
  // Performance: uses a single shared connection and batch IN queries.
  // Query count: 4 fixed queries regardless of order/subscription volume.
  // ─────────────────────────────────────────────────────────────────────────────
  @Get()
  async getOrders(@Req() req: Request) {
    const user = req.user as any;
    const email = user?.email;
    const userId = user?.user_id;

    // 1. Resolve customer via JOIN users
    const custRows = await this.db.query(
      `SELECT c.customer_id
       FROM customers c
       JOIN users u ON u.user_id = c.customer_id
       WHERE c.customer_id = $1 OR (u.email IS NOT NULL AND u.email = $2 AND u.email != '')
       LIMIT 1`,
      [userId, email || userId],
    );
    const customer = custRows?.[0];
    if (!customer) {
      return { status: true, orders: [], subscriptions: [] };
    }

    const customerId: string = customer.customer_id;

    // Open a single shared connection for all read queries
    const conn = await this.data.getSharedConnection();
    try {
      // ── Query 1: All orders for this customer ─────────────────────────────
      const [ordersRows]: any = await conn.query(
        `SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC`,
        [customerId],
      );
      const orders: any[] = ordersRows || [];

      // ── Query 2: All order items + variant + product name in one JOIN ──────
      let enrichedItems: any[] = [];
      if (orders.length > 0) {
        const orderIds = orders.map((o: any) => o.order_id);
        const placeholders = orderIds.map((_: any, i: number) => `$${i + 1}`).join(',');

        const [rawItems]: any = await conn.query(
          `SELECT DISTINCT ON (oi.id, oi.order_id, oi.variant_id)
             COALESCE(oi.id::text, oi.order_id || '_' || oi.variant_id) AS item_key,
             oi.id,
             oi.order_id,
             oi.variant_id,
             oi.quantity,
             oi.unit_price,
             oi.final_price,
             oi.is_free,
             pv.name    AS variant_name,
             pv.sku,
             COALESCE(NULLIF(pv.name, ''), p.name) AS product_name,
             p.product_id,
             pi.storage_key AS image_path
           FROM order_items oi
           LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id AND (pv.deleted_at IS NULL)
           LEFT JOIN products p          ON p.product_id = pv.product_id AND (p.deleted_at IS NULL)
           LEFT JOIN LATERAL (
             SELECT storage_key FROM product_images pi2
             WHERE pi2.variant_id = oi.variant_id
               AND pi2.storage_key IS NOT NULL AND pi2.storage_key <> ''
               AND (pi2.is_primary = true OR pi2.sort_order = 0)
             ORDER BY pi2.is_primary DESC NULLS LAST, pi2.sort_order ASC NULLS LAST
             LIMIT 1
           ) pi ON true
           WHERE oi.order_id IN (${placeholders})
           ORDER BY oi.id, oi.order_id, oi.variant_id`,
          orderIds,
        );
        enrichedItems = rawItems || [];
      }

      // Group items by order_id
      const itemsByOrder = new Map<string, any[]>();
      const baseUrl = process.env.MOBILE_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:5001';
      const mapImagePath = (imagePath: string | null) => {
        if (!imagePath) return null;
        if (imagePath.startsWith('http')) return imagePath;
        let cleanedPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
        if (cleanedPath.startsWith('uploads/')) {
          return `${baseUrl}/${cleanedPath}`;
        }
        return `${baseUrl}/uploads/${cleanedPath}`;
      };

      // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
      // Fetch feedback / ratings at the product level for this customer
      const [feedbackRows]: any = await conn.query(
        `SELECT reference_id, rating, feedback
         FROM customer_feedback
         WHERE customer_id = $1 AND reference_type = 'product'`,
        [customerId],
      );
      const feedbackMap = new Map<string, any>(
        (feedbackRows || []).map((f: any) => [f.reference_id, f]),
      );

      for (const item of enrichedItems) {
        const itemFeedback = item.product_id ? feedbackMap.get(item.product_id) : null;
        const mappedItem = {
          ...item,
          image_path: mapImagePath(item.image_path),
          rating: itemFeedback ? Number(itemFeedback.rating) : null,
          rating_feedback: itemFeedback?.feedback ?? null,
        };
        const list = itemsByOrder.get(mappedItem.order_id) ?? [];
        const itemUniqueKey = mappedItem.item_key || `${mappedItem.order_id}_${mappedItem.variant_id}_${mappedItem.id}`;
        if (!list.some((existing: any) => (existing.item_key || `${existing.order_id}_${existing.variant_id}_${existing.id}`) === itemUniqueKey)) {
          list.push(mappedItem);
        }
        itemsByOrder.set(mappedItem.order_id, list);
      }

      // Build formatted orders (in-memory only, no more DB calls)
      const formattedOrders = orders.map((order: any) => {
        const items = itemsByOrder.get(order.order_id) ?? [];
        // Support legacy order-level rating fallback by looking at the first item's rating
        const firstItemWithRating = items.find((i: any) => i.rating !== null);
        return {
          ...order,
          items,
          rating: firstItemWithRating ? Number(firstItemWithRating.rating) : null,
          rating_feedback: firstItemWithRating?.rating_feedback ?? null,
        };
      });

      // ── Query 4: Subscriptions + items + product name in one JOIN ─────────
      const [subRows]: any = await conn.query(
        `SELECT
           s.id,
           s.subscription_id,
           s.subscription_number,
           s.customer_id,
           s.schedule_type,
           s.branch_id,
           s.address_id,
           s.payment_type,
           s.billing_cycle,
           s.start_date,
           s.end_date,
           s.auto_renew,
           s.status,
           s.pause_from_date,
           s.pause_to_date,
           s.created_at,
           s.updated_at,
           COALESCE(si.subscription_item_id, si.id::text) AS si_id,
           si.product_variant_id,
           si.unit_price      AS si_unit_price,
           si.final_price     AS si_final_price,
           si.status          AS si_status,
           pv.name            AS variant_name,
           pv.sku,
           COALESCE(NULLIF(pv.name, ''), p.name) AS product_name,
           p.product_id
         FROM subscriptions s
         LEFT JOIN subscription_items si ON si.subscription_id = s.subscription_id
         LEFT JOIN product_variants pv   ON pv.variant_id = si.product_variant_id
         LEFT JOIN products p            ON p.product_id = pv.product_id
         WHERE s.customer_id = $1
         ORDER BY s.created_at DESC`,
        [customerId],
      );

      // Collapse flat JOIN rows into nested subscription objects
      const subsMap = new Map<string, any>();
      for (const row of (subRows || [])) {
        const subIdKey = row.subscription_id || row.id;
        if (!subsMap.has(subIdKey)) {
          subsMap.set(subIdKey, {
            id: subIdKey,
            subscription_id: subIdKey,
            subscription_number: row.subscription_number,
            customer_id: row.customer_id,
            schedule_type: row.schedule_type,
            branch_id: row.branch_id,
            address_id: row.address_id,
            payment_type: row.payment_type,
            billing_cycle: row.billing_cycle,
            start_date: row.start_date,
            end_date: row.end_date,
            auto_renew: row.auto_renew,
            status: row.status,
            pause_start_date: row.pause_from_date,
            pause_end_date: row.pause_to_date,
            created_at: row.created_at,
            updated_at: row.updated_at,
            items: [],
          });
        }
        if (row.si_id) {
          const vName = row.variant_name || row.product_name || 'Product';
          subsMap.get(subIdKey).items.push({
            id: row.si_id,
            subscription_id: subIdKey,
            product_variant_id: row.product_variant_id,
            unit_price: row.si_unit_price,
            final_price: row.si_final_price,
            status: row.si_status,
            variant_name: vName,
            sku: row.sku ?? '',
            product_name: vName,
            product_id: row.product_id,
          });
        }
      }

      return {
        status: true,
        orders: formattedOrders,              // includes order_source field; frontend splits
        subscriptions: Array.from(subsMap.values()),
      };
    } finally {
      conn?.release?.();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /customer/orders/bills
  // Returns subscription bills for the logged-in customer from customer_bills table.
  // ─────────────────────────────────────────────────────────────────────────────
  @Get('bills')
  async getBills(@Req() req: Request) {
    try {
      const user = req.user as any;
      const userId = user?.user_id || user?.userId || user?.id || user?.customer_id;

      if (!userId) {
        return { status: true, bills: [] };
      }

      // 1. Fetch all bills for this customer from customer_bills
      const billRows = await this.db.query(
        `SELECT bill_id, customer_id, bill_type, reference_id, payment_type, payment_method,
                billing_from, billing_to, due_date,
                subtotal, discount_amount, tax_amount, total_amount,
                paid_amount, due_amount, status, remarks, created_at, updated_at
         FROM customer_bills
         WHERE customer_id = $1
         ORDER BY created_at DESC`,
        [userId],
      );

      if (!billRows || billRows.length === 0) {
        return { status: true, bills: [] };
      }

      const bills = billRows.map((r: any) => ({
        ...r,
        bill_type: r.bill_type || (r.reference_id?.startsWith('SUB_') ? 'subscription' : 'order'),
        total_amount: Number(r.total_amount || 0),
        subtotal: Number(r.subtotal || r.total_amount || 0),
        discount_amount: Number(r.discount_amount || 0),
        tax_amount: Number(r.tax_amount || 0),
        paid_amount: Number(r.paid_amount || 0),
        due_amount: Number(r.due_amount || 0),
        items: [] as any[],
        item_name: '',
      }));

      // 2. Fetch item descriptions from subscription_items for subscription bills
      const subRefIds = bills
        .filter(b => b.bill_type === 'subscription' || (typeof b.reference_id === 'string' && (b.reference_id.startsWith('SUB_') || b.reference_id.startsWith('MSH') || b.reference_id.startsWith('BILL_MS') || b.reference_id.startsWith('BILL_MT'))))
        .map(b => b.reference_id || b.bill_id)
        .filter(id => typeof id === 'string' && (id.startsWith('SUB_') || id.startsWith('MSH') || id.startsWith('BILL_MS') || id.startsWith('BILL_MT')));

      if (subRefIds.length > 0) {
        try {
          const subItems = await this.db.query(
            `SELECT si.subscription_id,
                    COALESCE(
                      NULLIF(TRIM(CONCAT(p.name, ' - ', pv.name)), ' - '),
                      p.name,
                      pv.name,
                      'Subscription Item'
                    ) AS item_name,
                    COALESCE(p.name, '') AS product_name,
                    COALESCE(pv.name, '') AS variant_name,
                    1 AS quantity,
                    COALESCE(si.unit_price, 0) AS unit_price,
                    COALESCE(si.discount_amount, 0) AS discount_amount,
                    COALESCE(si.final_price, si.unit_price, 0) AS total_amount
             FROM subscription_items si
             LEFT JOIN product_variants pv ON pv.variant_id = si.product_variant_id
             LEFT JOIN products p ON p.product_id = pv.product_id
             WHERE (
               si.subscription_id = ANY($1::text[])
               OR ('SUB_' || si.subscription_id) = ANY($1::text[])
               OR ('BILL_' || si.subscription_id) = ANY($1::text[])
             )
             AND si.deleted_at IS NULL`,
            [subRefIds],
          );

          if (subItems && subItems.length > 0) {
            const subItemsMap = new Map<string, any[]>();
            for (const item of subItems) {
              const list = subItemsMap.get(item.subscription_id) || [];
              list.push(item);
              subItemsMap.set(item.subscription_id, list);
            }

            for (const bill of bills) {
              const refId = bill.reference_id || bill.bill_id;
              const matched = subItemsMap.get(refId) ||
                subItemsMap.get(String(refId).replace(/^SUB_/, '')) ||
                subItemsMap.get(String(refId).replace(/^BILL_/, ''));
              if (matched && matched.length > 0) {
                bill.items = matched;
                bill.item_name = matched.map(i => i.item_name).join(', ');
              }
            }
          }
        } catch (err) {
          console.error('getBills: Error fetching subscription items', err);
        }
      }

      // 3. Fetch item descriptions for order bills (from customer_bill_items)
      const orderBillIds = bills
        .filter(b => b.items.length === 0)
        .map(b => b.bill_id)
        .filter(Boolean);
      const orderRefIds = bills
        .filter(b => b.items.length === 0 && b.reference_id)
        .map(b => b.reference_id)
        .filter(Boolean);

      if (orderBillIds.length > 0 || orderRefIds.length > 0) {
        try {
          const billItems = await this.db.query(
            `SELECT cbi.bill_id,
                    cbi.reference_id AS order_id,
                    COALESCE(
                      NULLIF(TRIM(CONCAT(p.name, ' - ', pv.name)), ' - '),
                      p.name,
                      pv.name,
                      'Order Item'
                    ) AS item_name,
                    COALESCE(p.name, '') AS product_name,
                    COALESCE(pv.name, '') AS variant_name,
                    COALESCE(cbi.quantity, 1) AS quantity,
                    COALESCE(cbi.unit_price, 0) AS unit_price,
                    COALESCE(cbi.discount_amount, 0) AS discount_amount,
                    COALESCE(cbi.total_amount, 0) AS total_amount
             FROM customer_bill_items cbi
             LEFT JOIN product_variants pv ON pv.variant_id = cbi.product_variant_id
             LEFT JOIN products p ON p.product_id = pv.product_id
             WHERE cbi.bill_id = ANY($1::text[])
                OR cbi.reference_id = ANY($2::text[])`,
            [orderBillIds, orderRefIds],
          );

          if (billItems && billItems.length > 0) {
            const billItemsMap = new Map<string, any[]>();
            for (const bi of billItems) {
              if (bi.bill_id) {
                const list = billItemsMap.get(bi.bill_id) || [];
                list.push(bi);
                billItemsMap.set(bi.bill_id, list);
              }
              if (bi.order_id) {
                const list2 = billItemsMap.get(bi.order_id) || [];
                list2.push(bi);
                billItemsMap.set(bi.order_id, list2);
              }
            }

            for (const bill of bills) {
              if (bill.items.length === 0) {
                const matched = (bill.bill_id && billItemsMap.get(bill.bill_id)) ||
                                (bill.reference_id && billItemsMap.get(bill.reference_id));
                if (matched && matched.length > 0) {
                  bill.items = matched;
                  bill.item_name = matched.map((i: any) => i.item_name).join(', ');
                }
              }
            }
          }
        } catch (err) {
          console.error('getBills: Error fetching customer bill items', err);
        }
      }

      // 4. For subscription bills, fetch delivered orders with date & slot for that monthly billing period
      for (const bill of bills) {
        if (
          bill.bill_type === 'subscription' ||
          (bill.reference_id && String(bill.reference_id).startsWith('CONSOLIDATED')) ||
          (bill.bill_id && String(bill.bill_id).includes('PB'))
        ) {
          if (bill.billing_from && bill.billing_to) {
            try {
              const deliveredOrders = await this.db.query(
                `SELECT o.order_id, o.scheduled_date, o.delivery_slot, o.status,
                        oi.variant_id, oi.quantity, oi.unit_price, oi.final_price,
                        COALESCE(NULLIF(TRIM(CONCAT(p.name, ' - ', pv.name)), ' - '), oi.product_name, p.name, 'Subscription Item') AS item_name,
                        COALESCE(p.name, '') AS product_name,
                        COALESCE(pv.name, '') AS variant_name
                 FROM orders o
                 JOIN order_items oi ON oi.order_id = o.order_id
                 LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
                 LEFT JOIN products p ON p.product_id = pv.product_id
                  WHERE o.customer_id = $1
                    AND (o.scheduled_date >= $2::date AND o.scheduled_date <= $3::date)
                   AND o.status IN ('delivered', 'completed', 'active', 'confirmed')
                 ORDER BY o.scheduled_date ASC`,
                [userId, bill.billing_from, bill.billing_to],
              );
              if (deliveredOrders && deliveredOrders.length > 0) {
                bill.items = deliveredOrders;
                bill.item_name = Array.from(
                  new Set(deliveredOrders.map((d: any) => d.item_name)),
                ).join(', ');
                bill.deliveries_count = deliveredOrders.length;
              }
            } catch (err) {
              console.error('getBills: Error fetching delivered orders for subscription bill', err);
            }
          }
        }
      }

      // Sort combined by created_at DESC
      bills.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return { status: true, bills };
    } catch (error) {
      console.error('getBills error', error);
      return { status: true, bills: [] };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /customer/orders/:id
  // one-time order fetch
  //
  @Get(':id')
  async getOrder(@Req() req: Request, @Param('id') orderId: string) {
    const user = req.user as any;
    const email = user?.email;
    const userId = user?.user_id;

    const cleanId = (orderId || '').replace(/^#?F2H-/, '').trim();
    const isNumeric = /^\d+$/.test(cleanId);

    const orderRows = await this.db.query(
      `SELECT * FROM orders WHERE order_id = $1 OR order_id = $2 OR (order_id ILIKE $3) ${isNumeric ? 'OR id = $4' : ''} LIMIT 1`,
      isNumeric ? [cleanId, orderId, `%${cleanId}%`, parseInt(cleanId, 10)] : [cleanId, orderId, `%${cleanId}%`],
    );
    const order = orderRows?.[0];

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    const conn = await this.data.getSharedConnection();
    try {
      // Fetch order items with variant, product, and image joins
      const [rawItems]: any = await conn.query(
        `SELECT DISTINCT ON (oi.id, oi.order_id, oi.variant_id)
           COALESCE(oi.id::text, oi.order_id || '_' || oi.variant_id) AS item_key,
           oi.id,
           oi.order_id,
           oi.variant_id,
           oi.quantity,
           oi.unit_price,
           oi.final_price,
           oi.is_free,
           pv.name    AS variant_name,
           pv.sku,
           COALESCE(NULLIF(pv.name, ''), p.name) AS product_name,
           p.product_id,
           pi.storage_key AS image_path
         FROM order_items oi
         LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id AND (pv.deleted_at IS NULL)
         LEFT JOIN products p          ON p.product_id = pv.product_id AND (p.deleted_at IS NULL)
         LEFT JOIN LATERAL (
            SELECT storage_key FROM product_images pi2
            WHERE pi2.variant_id = oi.variant_id
              AND pi2.storage_key IS NOT NULL AND pi2.storage_key <> ''
              AND (pi2.is_primary = true OR pi2.sort_order = 0)
            ORDER BY pi2.is_primary DESC NULLS LAST, pi2.sort_order ASC NULLS LAST
            LIMIT 1
          ) pi ON true
         WHERE oi.order_id = $1
         ORDER BY oi.id, oi.order_id, oi.variant_id`,
        [order.order_id],
      );

      const baseUrl = process.env.MOBILE_BACKEND_URL || process.env.BACKEND_URL || 'https://f2hfresh.com';
      const mapImagePath = (imagePath: string | null) => {
        if (!imagePath) return null;
        if (imagePath.startsWith('http')) return imagePath;
        let cleanedPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
        if (cleanedPath.startsWith('uploads/')) {
          return `${baseUrl}/${cleanedPath}`;
        }
        return `${baseUrl}/uploads/${cleanedPath}`;
      };

      // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
      // Resolve customer to match customer_id properly
      let customerResult = await this.data.query('customers', {
        where: [{ column: 'email', operator: '=', value: email }],
        limit: 1,
      });
      if (!customerResult?.data?.length) {
        customerResult = await this.data.query('customers', {
          where: [{ column: 'customer_id', operator: '=', value: userId }],
          limit: 1,
        });
      }
      const customer = customerResult?.data?.[0];
      const customerId = customer ? customer.customer_id : userId;

      // Fetch feedback / ratings at the product level for this customer
      const [feedbackRows]: any = await conn.query(
        `SELECT reference_id, rating, feedback
         FROM customer_feedback
         WHERE customer_id = $1 AND reference_type = 'product'`,
        [customerId],
      );
      const feedbackMap = new Map<string, any>(
        (feedbackRows || []).map((f: any) => [f.reference_id, f]),
      );

      const enrichedItems: any[] = [];
      const seenItemKeys = new Set<string>();
      for (const item of (rawItems || [])) {
        const itemKey = item.item_key || `${item.order_id}_${item.variant_id}_${item.id}`;
        if (seenItemKeys.has(itemKey)) continue;
        seenItemKeys.add(itemKey);

        const itemFeedback = item.product_id ? feedbackMap.get(item.product_id) : null;
        enrichedItems.push({
          ...item,
          image_path: mapImagePath(item.image_path),
          rating: itemFeedback ? Number(itemFeedback.rating) : null,
          rating_feedback: itemFeedback?.feedback ?? null,
        });
      }

      const firstItemWithRating = enrichedItems.find((i: any) => i.rating !== null);

      return {
        status: true,
        order,
        items: enrichedItems,
        feedback: firstItemWithRating
          ? {
            reference_id: firstItemWithRating.product_id,
            rating: firstItemWithRating.rating,
            feedback: firstItemWithRating.rating_feedback,
          }
          : null,
      };
    } finally {
      conn?.release?.();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /customer/orders/:id/cancel
  // Cancel a pending one-time order with freeze-time check + wallet refund
  // ─────────────────────────────────────────────────────────────────────────────
  @Post(':id/cancel')
  async cancelOrder(@Req() req: Request, @Param('id') orderId: string) {
    const user = req.user as any;
    const email = user?.email;
    const userId = user?.user_id;
    const customerId = user?.user_id;

    // 1. Resolve customer
    let customerResult = await this.data.query('customers', {
      where: [{ column: 'customer_id', operator: '=', value: userId }],
      limit: 1,
    });

    const customer = customerResult?.data?.[0];
    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }

    // 2. Fetch order
    const orderResult = await this.data.query('orders', {
      where: [
        { column: 'order_id', operator: '=', value: orderId },
        { column: 'customer_id', operator: '=', value: customer.customer_id },
      ],
      limit: 1,
    });
    const order = orderResult?.data?.[0];

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    // 3. Only one-time / non-subscription pending orders can be cancelled
    if (order.order_source === 'subscription') {
      throw new BadRequestException('Subscription orders cannot be cancelled individually');
    }
    if (!['pending', 'placed'].includes(order.status?.toLowerCase())) {
      throw new BadRequestException(`Order cannot be cancelled: status is '${order.status}'`);
    }

    // 4. Freeze time check (M_FREEZE / E_FREEZE cron syntax)
    const mFreezeStr = process.env.M_FREEZE || '0 55 23 * * *';
    const eFreezeStr = process.env.E_FREEZE || '0 55 11 * * *';

    const parseFreezeTime = (cronStr: string) => {
      const parts = cronStr.trim().split(/\s+/);
      const minute = parts.length > 1 ? parseInt(parts[1], 10) : 55;
      const hour = parts.length > 2 ? parseInt(parts[2], 10) : 23;
      return { hour, minute };
    };

    const mFreeze = parseFreezeTime(mFreezeStr);
    const eFreeze = parseFreezeTime(eFreezeStr);
    const nowIst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

    const dateStr = typeof order.scheduled_date === 'string'
      ? order.scheduled_date.split('T')[0]
      : new Date(order.scheduled_date).toISOString().split('T')[0];
    const [y, m, d] = dateStr.split('-').map(Number);

    let freezeLimit: Date;
    if (order.delivery_slot?.toLowerCase() === 'evening') {
      freezeLimit = new Date(y, m - 1, d, eFreeze.hour, eFreeze.minute, 0);
    } else {
      const prev = new Date(y, m - 1, d - 1);
      freezeLimit = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate(), mFreeze.hour, mFreeze.minute, 0);
    }


    if (nowIst.getTime() >= freezeLimit.getTime()) {
      throw new BadRequestException('Order cannot be cancelled — past dispatch freeze time.');
    }

    // 5. Cancel + wallet refund in a transaction
    const refundAmount = Number(order.total_amount || 0);
    const walletBalance = Number(customer.wallet_balance || 0);
    const newBalance = walletBalance + refundAmount;

    if (nowIst.getTime() >= freezeLimit.getTime()) {
      throw new BadRequestException({
        message: 'Order cannot be cancelled — past dispatch freeze time.',
        current_time: nowIst,
        freeze_time: freezeLimit,
        slot: order.delivery_slot,
        scheduled_date: order.scheduled_date,
      });
    }
    return this.data.executeTransaction(async (conn) => {
      await this.data.update(
        'orders',
        { status: 'cancelled', updated_at: new Date() },
        [{ column: 'order_id', operator: '=', value: order.order_id }],
        { transaction: conn },
      );

      // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
      // Record the refund in the refunds table
      const refundNumber = 'RFND-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);
      const walletTxId = 'WTR_' + Date.now().toString(36).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
      let walletTransactionId: string | null = null;

      if ((order.payment_mode === 'wallet' || order.payment_mode === 'upi') && refundAmount > 0) {
        const custUpdate = await this.data.update(
          'customers',
          { wallet_balance: newBalance },
          [{ column: 'customer_id', operator: '=', value: customer.customer_id }],
          { transaction: conn },
        );
        if (custUpdate && !custUpdate.status) {
          throw new Error(custUpdate.message || 'Failed to update customer wallet balance');
        }

        const txInsert = await this.data.insert('customer_wallet_transactions', {
          transaction_id: walletTxId,
          customer_id: customer.customer_id,
          transaction_type: 'credit',
          reference_type: 'refund',
          reference_id: order.order_id,
          amount: refundAmount,
          balance_after: newBalance,
          remarks: `Refund for cancelled order ${order.order_id}`,
          created_by: 'system',
          created_at: new Date(),
        }, { transaction: conn });
        this.logger.log('Wallet transaction insert result', txInsert);
        if (txInsert && txInsert.status) {
          walletTransactionId = txInsert.id || walletTxId;
        } else {
          throw new Error(txInsert?.message || 'Failed to record customer wallet transaction');
        }

        // Insert processed wallet refund record
        const refInsert = await this.data.insert('refunds', {
          refund_number: refundNumber,
          customer_id: customer.customer_id,
          order_id: order.order_id,
          refund_amount: refundAmount,
          refund_type: 'wallet',
          status: 'processed',
          reason: `Order Cancelled - Auto wallet refund for order ${order.order_id}`,
          approved_by: 'system',
          approved_at: new Date(),
          processed_at: new Date(),
          transaction_id: String(walletTransactionId || walletTxId),
          created_at: new Date(),
          updated_at: new Date(),
        }, { transaction: conn });
        if (refInsert && !refInsert.status) {
          throw new Error(refInsert?.message || 'Failed to record refund entry');
        }
      }

      // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
      // Insert cancellation notification to customer
      const notificationId = 'NTF-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);
      const notifTitle = 'Order Cancelled';
      let notifMessage = `Your order #${order.order_id.substring(0, Math.min(order.order_id.length, 12))} has been successfully cancelled.`;
      if ((order.payment_mode === 'wallet' || order.payment_mode === 'upi') && refundAmount > 0) {
        notifMessage += ` A refund of ₹${refundAmount.toFixed(0)} has been credited to your wallet.`;
      } else if (refundAmount > 0) {
        notifMessage += ` A refund of ₹${refundAmount.toFixed(0)} is being processed via ${order.payment_mode === 'cod' ? 'Cash' : 'UPI'}.`;
      }

      await this.data.insert('notifications', {
        notification_id: notificationId,
        title: notifTitle,
        message: notifMessage,
        medium: 'websocket',
        type: 'info',
        priority: 'medium',
        status: 'active',
        created_by: 'system',
        updated_by: 'system',
        created_at: new Date(),
        updated_at: new Date(),
      }, { transaction: conn });

      await this.data.insert('notification_recipients', {
        notification_id: notificationId,
        user_id: customer.customer_id,
        status: 'unread',
        notified_at: new Date(),
        created_by: 'system',
        updated_by: 'system',
        created_at: new Date(),
        updated_at: new Date(),
      }, { transaction: conn });

      return { status: true, message: 'Order cancelled successfully' };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /customer/orders/:id/rate
  // Submit or update a star rating + text feedback for a delivered order
  // ─────────────────────────────────────────────────────────────────────────────
  @Post(':id/rate')
  async rateOrder(
    @Req() req: Request,
    @Param('id') orderId: string,
    @Body() body: { product_id?: string; rating: number; feedback?: string },
  ) {
    const user = req.user as any;
    const email = user?.email;
    const userId = user?.user_id;

    // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
    // Resolve customer to match customer_id properly
    let customerResult = await this.data.query('customers', {
      where: [{ column: 'email', operator: '=', value: email }],
      limit: 1,
    });
    if (!customerResult?.data?.length) {
      customerResult = await this.data.query('customers', {
        where: [{ column: 'customer_id', operator: '=', value: userId }],
        limit: 1,
      });
    }
    const customer = customerResult?.data?.[0];
    const customerId = customer ? customer.customer_id : userId;

    let productId = body.product_id;
    if (productId) {
      const vRes = await this.db.query(
        `SELECT product_id FROM product_variants WHERE variant_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [productId],
      );
      if (vRes && vRes.length > 0 && vRes[0].product_id) {
        productId = vRes[0].product_id;
      }
    } else {
      const conn = await this.data.getSharedConnection();
      try {
        const [rows]: any = await conn.query(
          `SELECT pv.product_id 
           FROM order_items oi
           JOIN product_variants pv ON pv.variant_id = oi.variant_id AND pv.deleted_at IS NULL
           WHERE oi.order_id = $1 
           LIMIT 1`,
          [orderId],
        );
        if (rows && rows.length > 0) {
          productId = rows[0].product_id;
        }
      } finally {
        conn?.release?.();
      }
    }

    if (!productId) {
      throw new BadRequestException('Product not found for rating');
    }

    const existingResult = await this.data.query('customer_feedback', {
      where: [
        { column: 'customer_id', operator: '=', value: customerId },
        { column: 'reference_type', operator: '=', value: 'product' },
        { column: 'reference_id', operator: '=', value: productId },
      ],
      limit: 1,
    });

    if (existingResult?.data?.length) {
      await this.data.update(
        'customer_feedback',
        { rating: body.rating, feedback: body.feedback || '', created_at: new Date() },
        [{ column: 'id', operator: '=', value: existingResult.data[0].id }],
      );
    } else {
      await this.data.insert('customer_feedback', {
        customer_id: customerId,
        reference_type: 'product',
        reference_id: productId,
        rating: body.rating,
        feedback: body.feedback || '',
        status: 'open',
        created_at: new Date(),
      });
    }

    return { status: true, message: 'Rating submitted successfully' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /customer/orders/:id/tracking
  // Returns live driver location, ETA, and stops-away for an active delivery
  // ─────────────────────────────────────────────────────────────────────────────
  @Get(':id/tracking')
  async getOrderTracking(@Req() req: Request, @Param('id') orderId: string) {
    const user = req.user as any;
    const userId = user?.user_id;

    // Get order details
    const orderRes = await this.db.query(
      `SELECT o.order_id, o.status, o.customer_id, o.delivery_partner_id,
              o.delivery_run_id, o.run_sequence, o.address_id,
              ca.latitude AS cust_lat, ca.longitude AS cust_lng
       FROM orders o
       LEFT JOIN customer_addresses ca ON ca.address_id = o.address_id
       WHERE o.order_id = $1`,
      [orderId],
    );
    if (!orderRes?.length) throw new BadRequestException('Order not found');
    const order = orderRes[0];

    // Only relevant for active deliveries
    if (!['out_for_delivery', 'assigned', 'confirmed'].includes(order.status)) {
      return {
        status: true,
        order_id: orderId,
        order_status: order.status,
        tracking_available: false,
        message: order.status === 'delivered' ? 'Order has been delivered' : 'Delivery has not started yet',
      };
    }

    // Get driver's current location (Redis cache first, then DB fallback)
    let driverLat: number | null = null;
    let driverLng: number | null = null;
    let driverName: string | null = null;
    let driverPhone: string | null = null;

    if (order.delivery_partner_id) {
      // 1. Try Redis cache first (real-time telemetry)
      const cachedLoc: any = await this.redisService.fetch(
        `delivery_partner_location:${order.delivery_partner_id}`,
      );
      if (cachedLoc && cachedLoc.latitude && cachedLoc.longitude) {
        driverLat = Number(cachedLoc.latitude);
        driverLng = Number(cachedLoc.longitude);
      }

      // Fetch driver profile (name & phone) from users / delivery_partners
      const driverProfile = await this.db.query(
        `SELECT 
           COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.user_name, 'Delivery Partner') AS driver_name,
           COALESCE(u.phone, '') AS phone
         FROM users u
         LEFT JOIN delivery_partners dp ON dp.delivery_partner_id = u.user_id
         WHERE u.user_id = $1 OR dp.delivery_partner_id = $1
         LIMIT 1`,
        [order.delivery_partner_id],
      );
      if (driverProfile?.length) {
        driverName = driverProfile[0].driver_name;
        driverPhone = driverProfile[0].phone;
      }

      // 2. Fallback to DB if Redis cache missed
      if (driverLat === null || driverLng === null) {
        const locRes = await this.db.query(
          `SELECT latitude, longitude
           FROM delivery_location_logs
           WHERE user_id = $1
           ORDER BY recorded_at DESC LIMIT 1`,
          [order.delivery_partner_id],
        );
        if (locRes?.length) {
          driverLat = Number(locRes[0].latitude);
          driverLng = Number(locRes[0].longitude);
        }
      }
    }

    // Calculate stops away from pending orders in same run with lower sequence
    let stopsAway = 0;
    if (order.delivery_run_id && order.run_sequence) {
      const pendingRes = await this.db.query(
        `SELECT COUNT(*)::int AS cnt
         FROM orders
         WHERE delivery_run_id = $1
           AND run_sequence < $2
           AND status NOT IN ('delivered', 'failed', 'cancelled')`,
        [order.delivery_run_id, order.run_sequence],
      );
      stopsAway = Number(pendingRes?.[0]?.cnt ?? 0);
    }

    // ETA: avg 4 minutes per stop
    const etaMinutes = stopsAway > 0 ? stopsAway * 4 : 5;

    return {
      status: true,
      order_id: orderId,
      order_status: order.status,
      tracking_available: true,
      driver: {
        name: driverName,
        phone: driverPhone,
        latitude: driverLat,
        longitude: driverLng,
      },
      customer: {
        latitude: order.cust_lat ? Number(order.cust_lat) : null,
        longitude: order.cust_lng ? Number(order.cust_lng) : null,
      },
      stops_away: stopsAway,
      eta_minutes: etaMinutes,
    };
  }
}