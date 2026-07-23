import { Body, Controller, Get, Post, UseGuards, Req, BadRequestException, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DataService } from 'src/shared/database/Data.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { Request } from 'express';

@Controller({ path: 'customer/orders', version: '1' })
@UseGuards(AuthGuard('jwt'))
export class CustomerOrderController {
  constructor(
    private readonly data: DataService,
    private readonly db: DatabaseService,
  ) {}

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

    // 1. Resolve customer (2 queries at most, typically 1)
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
          `SELECT
             oi.order_id,
             oi.variant_id,
             oi.quantity,
             oi.unit_price,
             oi.final_price,
             oi.is_free,
             pv.name    AS variant_name,
             pv.sku,
             p.name     AS product_name,
             p.product_id,
             pi.url     AS image_path
           FROM order_items oi
           LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
           LEFT JOIN products p          ON p.product_id = pv.product_id
           LEFT JOIN product_images pi   ON pi.variant_id = oi.variant_id
           WHERE oi.order_id IN (${placeholders})`,
          orderIds,
        );
        enrichedItems = rawItems || [];
      }

      // Group items by order_id
      const itemsByOrder = new Map<string, any[]>();
      const baseUrl = process.env.BACKEND_URL || 'http://localhost:8000';
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
        list.push(mappedItem);
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
           si.id              AS si_id,
           si.product_variant_id,
           si.default_m_quantity,
           si.default_e_quantity,
           si.unit_price      AS si_unit_price,
           si.final_price     AS si_final_price,
           si.status          AS si_status,
           pv.name            AS variant_name,
           pv.sku,
           p.name             AS product_name,
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
        if (!subsMap.has(row.id)) {
          subsMap.set(row.id, {
            id: row.id,
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
          subsMap.get(row.id).items.push({
            id: row.si_id,
            subscription_id: row.id,
            product_variant_id: row.product_variant_id,
            default_m_quantity: row.default_m_quantity,
            default_e_quantity: row.default_e_quantity,
            unit_price: row.si_unit_price,
            final_price: row.si_final_price,
            status: row.si_status,
            variant_name: row.variant_name ?? '',
            sku: row.sku ?? '',
            product_name: row.product_name ?? 'Product',
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
  // POST /customer/orders/:id
  // one-time order fetch
  //
  @Get(':id')
  async getOrder(@Req() req: Request, @Param('id') orderId: string){
    const user = req.user as any;
    const email = user?.email;
    const userId = user?.user_id;
    
    const orderResult = await this.data.query('orders', {
      where: [
        { column: 'order_id', operator: '=', value: orderId },
      ],
      limit: 1,
    });
    const order = orderResult?.data?.[0];
    
    if (!order) {
      throw new BadRequestException('Order not found');
    }

    const conn = await this.data.getSharedConnection();
    try {
      // Fetch order items with variant, product, and image joins
      const [rawItems]: any = await conn.query(
        `SELECT
           oi.order_id,
           oi.variant_id,
           oi.quantity,
           oi.unit_price,
           oi.final_price,
           oi.is_free,
           pv.name    AS variant_name,
           pv.sku,
           p.name     AS product_name,
           p.product_id,
           pi.url     AS image_path
         FROM order_items oi
         LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
         LEFT JOIN products p          ON p.product_id = pv.product_id
         LEFT JOIN product_images pi   ON pi.variant_id = oi.variant_id
         WHERE oi.order_id = $1`,
        [orderId],
      );
      
      const baseUrl = process.env.BACKEND_URL || 'http://localhost:8000';
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

      const enrichedItems = (rawItems || []).map((item: any) => {
        const itemFeedback = item.product_id ? feedbackMap.get(item.product_id) : null;
        return {
          ...item,
          image_path: mapImagePath(item.image_path),
          rating: itemFeedback ? Number(itemFeedback.rating) : null,
          rating_feedback: itemFeedback?.feedback ?? null,
        };
      });

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
      const hour   = parts.length > 2 ? parseInt(parts[2], 10) : 23;
      return { hour, minute };
    };

    const mFreeze = parseFreezeTime(mFreezeStr);
    const eFreeze = parseFreezeTime(eFreezeStr);
    const nowIst  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

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
    const refundAmount  = Number(order.total_amount || 0);
    const walletBalance = Number(customer.wallet_balance || 0);
    const newBalance    = walletBalance + refundAmount;

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
      let walletTransactionId: string | null = null;

      if (order.payment_mode === 'wallet' && refundAmount > 0) {
        await this.data.update(
          'customers',
          { wallet_balance: newBalance },
          [{ column: 'customer_id', operator: '=', value: customer.customer_id }],
          { transaction: conn },
        );

        const txInsert = await this.data.insert('customer_wallet_transactions', {
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
        console.log('Wallet transaction insert result', txInsert);
        if (txInsert && txInsert.status && txInsert.id) {
          walletTransactionId = txInsert.id;
        }

        // Insert processed wallet refund record
        await this.data.insert('refunds', {
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
          transaction_id: String(walletTransactionId),
          created_at: new Date(),
          updated_at: new Date(),
        }, { transaction: conn });
      } else {
        // Insert pending offline/manual refund record
        const refundType = order.payment_mode === 'cod' ? 'cash' : 'upi';
        await this.data.insert('refunds', {
          refund_number: refundNumber,
          customer_id: customer.customer_id,
          order_id: order.order_id,
          refund_amount: refundAmount,
          refund_type: refundType,
          status: 'pending',
          reason: `Order Cancelled - Manual refund required for order ${order.order_id}`,
          created_at: new Date(),
          updated_at: new Date(),
        }, { transaction: conn });
      }

      // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
      // Insert cancellation notification to customer
      const notificationId = 'NTF-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);
      const notifTitle = 'Order Cancelled';
      let notifMessage = `Your order #${order.order_id.substring(0, Math.min(order.order_id.length, 12))} has been successfully cancelled.`;
      if (order.payment_mode === 'wallet' && refundAmount > 0) {
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
    if (!productId) {
      const conn = await this.data.getSharedConnection();
      try {
        const [rows]: any = await conn.query(
          `SELECT pv.product_id 
           FROM order_items oi
           JOIN product_variants pv ON pv.variant_id = oi.variant_id
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

    // Get driver's current location
    let driverLat: number | null = null;
    let driverLng: number | null = null;
    let driverName: string | null = null;
    let driverPhone: string | null = null;

    if (order.delivery_partner_id) {
      const locRes = await this.db.query(
        `SELECT dpl.latitude, dpl.longitude, dp.name AS driver_name, dp.phone
         FROM delivery_partner_locations dpl
         JOIN delivery_partners dp ON dp.user_id = dpl.user_id
         WHERE dpl.user_id = $1
         ORDER BY dpl.recorded_at DESC LIMIT 1`,
        [order.delivery_partner_id],
      );
      if (locRes?.length) {
        driverLat = Number(locRes[0].latitude);
        driverLng = Number(locRes[0].longitude);
        driverName = locRes[0].driver_name;
        driverPhone = locRes[0].phone;
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