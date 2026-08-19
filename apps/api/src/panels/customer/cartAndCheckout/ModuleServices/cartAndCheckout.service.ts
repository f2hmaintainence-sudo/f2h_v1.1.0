import { BadRequestException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import {
  CreateCartDto,
  CartDto,
  CheckOutDto,
  OnetimeCheckoutItemDto,
} from '../dto/cart.dto';
import { generateId } from 'src/helpers/RandomHelper';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';
import { NotificationService } from 'src/notifications/notification.service';

import { FirstOrderDetectorService } from '../../referral/services/first-order-detector.service';
import { ReferralRewardEngineService } from '../../referral/services/referral-reward-engine.service';

@Injectable()
export class CartService {
  constructor(
    private readonly db: DatabaseService,
    private readonly Data: DataService,
    private readonly developer: DeveloperService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly notificationService: NotificationService,
    private readonly firstOrderDetector: FirstOrderDetectorService,
    private readonly referralRewardEngine: ReferralRewardEngineService,
  ) { }

  async syncCart(body: CartDto) {
    const items = body.items || [];
    let itemsSubtotal = 0;

    if (body.customer_id) {
      await this.Data.upsert(
        'carts',
        {
          user_id: body.customer_id,
          cart_data: JSON.stringify(items),
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          user_id: body.customer_id,
        },
        {
          cart_data: JSON.stringify(items),
          updated_at: new Date(),
        },
      );
    }

    const variantIds = items.map((item) => item.product_variant_id).filter(Boolean);
    const productsByVariantId: Record<string, any> = {};
    if (variantIds.length > 0) {
      const queryResult = await this.db.query(
        `SELECT variant_id, price FROM product_variants WHERE variant_id = ANY($1)`,
        [variantIds],
      );
      for (const row of queryResult || []) {
        productsByVariantId[row.variant_id] = row;
      }
    }

    for (const item of items) {
      const product = productsByVariantId[item.product_variant_id];
      itemsSubtotal += this.calculateItemSubtotal(item, product);
    }

    return {
      billSummary: this.calculateBillSummary(itemsSubtotal),
    };
  }

  async getCartItems(userId: string) {
    const result = await this.Data.query('carts', {
      select: ['user_id', 'cart_data', 'created_at', 'updated_at'],
      where: [{ column: 'user_id', operator: '=', value: userId }],
    });
    const cartData = result?.data?.[0];
    const items = cartData
      ? typeof cartData.cart_data === 'string'
        ? JSON.parse(cartData.cart_data)
        : cartData.cart_data
      : [];
    let itemsSubtotal = 0;
    const formattedItems: any[] = [];

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

    const variantIds = items.map((item: any) => item.product_variant_id).filter(Boolean);
    const productsByVariantId: Record<string, any> = {};
    if (variantIds.length > 0) {
      const queryResult = await this.db.query(
        `SELECT 
          pv.*, 
          p.name AS product_name, 
          p.is_subscribable, 
          p.is_one_time, 
          pi.storage_key AS image_path
         FROM product_variants pv
         LEFT JOIN products p ON pv.product_id = p.product_id
         LEFT JOIN LATERAL (
            SELECT storage_key FROM product_images pi2
            WHERE pi2.variant_id = pv.variant_id
              AND pi2.storage_key IS NOT NULL AND pi2.storage_key <> ''
              AND (pi2.is_primary = true OR pi2.sort_order = 0)
            ORDER BY pi2.is_primary DESC NULLS LAST, pi2.sort_order ASC NULLS LAST
            LIMIT 1
          ) pi ON true
         WHERE pv.variant_id = ANY($1) AND pv.status = 'active'`,
        [variantIds],
      );
      for (const row of queryResult || []) {
        productsByVariantId[row.variant_id] = row;
      }
    }

    for (const item of items) {
      const product = productsByVariantId[item.product_variant_id];

      itemsSubtotal += this.calculateItemSubtotal(item, product);

      formattedItems.push({
        user_id: userId,
        cart_data: {
          ...item,
          name: product?.product_name || product?.name || 'Product',
          sku: product?.sku,
          price: product?.price,
          unit_value: product?.unit_value,
          unit_type: product?.unit_type,
          status: product?.status,
          is_out_of_stock: product?.is_out_of_stock,
          manageable_qty: product?.manageable_qty,
          sort_order: product?.sort_order,
          image_path: mapImagePath(product?.image_path),
          is_subscribable: product?.is_subscribable,
          is_one_time: product?.is_one_time,
        },
      });
    }

    return {
      items: formattedItems,
      billSummary: this.calculateBillSummary(itemsSubtotal),
    };
  }

  private calculateItemSubtotal(item: any, product: any): number {
    const price = product?.price ? Number(product.price) : 150;
    const qty = item.onetime_details?.quantity || item.quantity || 1;
    return price * qty;
  }

  private calculateBillSummary(itemsSubtotal: number) {
    const deliveryPartnerFee = itemsSubtotal > 0 ? 29.0 : 0.0;
    const taxesAndHandling = itemsSubtotal > 0 ? 12.0 : 0.0;
    const grandTotal = itemsSubtotal > 0 ? itemsSubtotal + deliveryPartnerFee + taxesAndHandling : 0.0;

    return {
      itemsSubtotal,
      deliveryPartnerFee,
      taxesAndHandling,
      grandTotal,
    };
  }

  async checkout(body: CheckOutDto, req?: any) {
    const customerId = body.customer_id;
    const itemsToCheckout = body.items || [];
    if (!customerId) {
      throw new BadRequestException('Customer ID is required for checkout');
    }

    // Resolve Delivery Address
    let addressId = body.address_id;
    let addressLine = '';
    let contactNumber = '';
    let addressBranchId = null;
    let customerName = '';

    if (addressId) {
      const addressResult = await this.Data.query('customer_addresses', {
        select: ['address_id', 'address_line', 'contact_mobile', 'branch_id', 'contact_name'],
        where: [
          { column: 'address_id', operator: '=', value: addressId },
          { column: 'customer_id', operator: '=', value: customerId },
        ],
        limit: 1,
      });
      const addr = addressResult?.data?.[0];
      if (addr) {
        addressLine = addr.address_line || '';
        contactNumber = addr.contact_mobile || '';
        addressBranchId = addr.branch_id || null;
        customerName = addr.contact_name || '';
      } else {
        const fallbackAddress = await this.Data.query('customer_addresses', {
          select: ['address_id', 'address_line', 'contact_mobile', 'branch_id', 'contact_name'],
          where: [
            { column: 'customer_id', operator: '=', value: customerId },
            { column: 'is_default', operator: '=', value: true },
          ],
          limit: 1,
        });
        const fallbackAddr = fallbackAddress?.data?.[0];
        if (fallbackAddr) {
          addressId = fallbackAddr.address_id;
          addressLine = fallbackAddr.address_line || '';
          contactNumber = fallbackAddr.contact_mobile || '';
          addressBranchId = fallbackAddr.branch_id || null;
          customerName = fallbackAddr.contact_name || '';
        }
      }
    }

    if (!addressId) {
      throw new BadRequestException('Delivery address not found. Please add an address before checking out.');
    }

    let email = (req as any)?.user?.email;
    const custQuery = `
      SELECT
        c.customer_id,
        c.wallet_balance,
        c.branch_id,
        c.is_postpaid_enabled,
        c.postpaid_credit_limit,
        u.first_name,
        u.last_name,
        u.user_name,
        u.phone,
        u.email
      FROM customers c
      JOIN users u ON u.user_id = c.customer_id
      WHERE c.customer_id = $1 OR (u.email IS NOT NULL AND u.email = $2 AND u.email != '')
      LIMIT 1
    `;
    const custRows = await this.db.query(custQuery, [customerId, email || customerId]);
    let customer = custRows?.[0];

    if (!customer) {
      const userRes = await this.Data.query('users', {
        where: [{ column: 'user_id', operator: '=', value: customerId }],
        limit: 1,
      });
      const userObj = userRes?.data?.[0];
      if (userObj) {
        try {
          const now = new Date();
          const activeBranchRes = await this.Data.query('branches', {
            where: [{ column: 'is_active', operator: '=', value: true }],
            limit: 1,
          });
          const activeBranchId = activeBranchRes?.data?.[0]?.branch_id || 'BRANCH_KUPPAM_01';
          await this.Data.insert('customers', {
            customer_id: customerId,
            branch_id: activeBranchId,
            wallet_balance: 0,
            customer_status: 'active',
            created_at: now,
            updated_at: now,
          });
          const reFetch = await this.db.query(custQuery, [customerId, email || customerId]);
          customer = reFetch?.[0];
        } catch (_) { }
      }
    }

    if (!customer) {
      throw new BadRequestException('Customer profile not found');
    }

    const branchId = addressBranchId || customer.branch_id || null;
    if (!branchId || branchId === 'ALL') {
      throw new BadRequestException(
        'Unable to determine delivery branch for this address. Please select a valid delivery address.',
      );
    }
    const walletBalance = Number(customer.wallet_balance || 0);
    if (!customerName) {
      customerName = customer.full_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer';
    }
    if (!contactNumber) {
      contactNumber = customer.phone || '';
    }

    // 1. Fetch current cart
    let currentCartItems: any[] = [];
    try {
      const cartResult = await this.Data.query('carts', {
        select: ['cart_data'],
        where: [{ column: 'user_id', operator: '=', value: customerId }],
      });
      const cartRow = cartResult?.data?.[0];
      currentCartItems = cartRow
        ? typeof cartRow.cart_data === 'string'
          ? JSON.parse(cartRow.cart_data)
          : cartRow.cart_data || []
        : [];
    } catch (_) { }

    // 2. Create set of checkout item variantIds
    const checkoutSet = new Set(
      itemsToCheckout.map((item) => item.product_variant_id),
    );

    // 3. Filter out checked out items
    const remainingCartItems = currentCartItems.filter((item: any) => !checkoutSet.has(item.product_variant_id));

    // 4. Pre-calculate total amount and build grouping map for one-time orders
    let totalCheckoutAmount = 0;
    const paymentMethod = body.payment_method || 'wallet';
    const isCod = paymentMethod === 'cod';
    const paymentType = body.payment_type || (isCod ? 'postpaid' : 'prepaid');

    type OnetimeEntry = { item: OnetimeCheckoutItemDto; price: number; qty: number; productName: string };
    type OnetimeGroup = { deliveryDate: string; deliverySlot: string; items: OnetimeEntry[]; subtotal: number };
    const onetimeGroups = new Map<string, OnetimeGroup>();

    for (const item of itemsToCheckout) {
      const productRows = await this.db.query(
        `SELECT pv.price, p.name AS product_name
         FROM product_variants pv
         LEFT JOIN products p ON pv.product_id = p.product_id
         WHERE pv.variant_id = $1 LIMIT 1`,
        [item.product_variant_id],
      );
      const price = productRows?.[0]?.price ? Number(productRows[0].price) : 150;
      const productName = productRows?.[0]?.product_name || 'Product';
      const onetimeItem = item as OnetimeCheckoutItemDto;
      const qty = onetimeItem.onetime_details?.quantity || 1;
      const subtotal = price * qty;
      totalCheckoutAmount += subtotal;

      const deliveryDate = onetimeItem.onetime_details?.delivery_date || new Date().toISOString().split('T')[0];
      const deliverySlot = onetimeItem.onetime_details?.delivery_slot || 'Morning';
      const groupKey = `${deliveryDate}_${deliverySlot.toLowerCase()}`;

      if (!onetimeGroups.has(groupKey)) {
        onetimeGroups.set(groupKey, { deliveryDate, deliverySlot, items: [], subtotal: 0 });
      }
      const group = onetimeGroups.get(groupKey)!;
      group.items.push({ item: onetimeItem, price, qty, productName });
      group.subtotal += subtotal;
    }

    let onetimeTotal = 0;
    for (const [, g] of onetimeGroups) onetimeTotal += g.subtotal;

    let newBalance = walletBalance;

    if (onetimeTotal > 0 && paymentMethod === 'wallet') {
      if (walletBalance < onetimeTotal) {
        throw new BadRequestException('Insufficient wallet balance. Please top up your wallet.');
      }
      newBalance = walletBalance - onetimeTotal;
    }

    const orderedProductNames: string[] = [];
    let referenceId: string | null = null;

    const walletTransactionsToInsert: {
      amount: number;
      reference_type: string;
      reference_id: string;
      remarks: string;
    }[] = [];

    // A. Deduct customer wallet balance
    if (paymentMethod === 'wallet' && onetimeTotal > 0 && newBalance !== walletBalance) {
      await this.Data.update(
        'customers',
        { wallet_balance: newBalance },
        [{ column: 'customer_id', operator: '=', value: customerId }],
      );
    }

    // B. Process one-time order groups
    for (const [, group] of onetimeGroups) {
      const orderId = generateId('Ord', 15);
      if (!referenceId) {
        referenceId = orderId;
      }

      const gstAmount = 0;
      const totalAmount = group.subtotal + gstAmount;

      const orderInsert = await this.Data.insert(
        'orders',
        {
          order_id: orderId,
          customer_id: customerId,
          address_id: addressId,
          branch_id: branchId,
          address_line: addressLine,
          contact_number: contactNumber,
          customer_name: customerName,
          order_source: 'one-time',
          delivery_slot: group.deliverySlot.toLowerCase() === 'morning' ? 'morning' : 'evening',
          scheduled_date: group.deliveryDate,
          status: 'placed',
          subtotal: group.subtotal,
          discount_amount: 0,
          gst_amount: gstAmount,
          total_amount: totalAmount,
          payment_mode: paymentMethod === 'cod' ? 'cod' : (paymentType === 'postpaid' ? 'postpaid' : paymentMethod),
          payment_status: paymentType === 'postpaid' || isCod ? 'pending' : 'paid',
          created_at: new Date(),
          updated_at: new Date(),
        },
      );

      if (!orderInsert?.status) {
        throw new Error(`Failed to create order record for group: ${group.deliveryDate}/${group.deliverySlot}`);
      }

      for (const entry of group.items) {
        if (entry.productName) orderedProductNames.push(entry.productName);

        const itemInsert = await this.Data.insert(
          'order_items',
          {
            order_id: orderId,
            variant_id: entry.item.product_variant_id,
            product_variant_id: entry.item.product_variant_id,
            product_name: entry.productName,
            unit_price: entry.price,
            quantity: entry.qty,
            total_price: entry.qty * entry.price,
            is_free: false,
            created_at: new Date(),
          },
        );

        if (!itemInsert?.status) {
          throw new Error(`Failed to create order item for variant: ${entry.item.product_variant_id}`);
        }
      }

      await this.broadcastNewOrderToLiveOrders(orderId);

      walletTransactionsToInsert.push({
        amount: totalAmount,
        reference_type: 'order',
        reference_id: orderId,
        remarks: paymentType === 'postpaid' ? 'Checkout postpaid order placement' : 'Checkout order placement',
      });
    }

    // C. Save remaining cart items
    try {
      await this.Data.upsert(
        'carts',
        {
          user_id: customerId,
          cart_data: JSON.stringify(remainingCartItems),
          updated_at: new Date(),
        },
        {
          user_id: customerId,
        },
        {
          cart_data: JSON.stringify(remainingCartItems),
          updated_at: new Date(),
        },
      );
    } catch (_) { }

    // D. Insert wallet ledger entries (ONLY for prepaid wallet orders)
    if (paymentMethod === 'wallet' && !isCod && paymentType === 'prepaid') {
      await this.insertWalletTransactions(customerId, walletBalance, walletTransactionsToInsert);
    }

    const isPostpaidOrder = paymentType === 'postpaid' || paymentMethod === 'postpaid' || (body.payment_type || '').toLowerCase() === 'postpaid';
    const isCodOrder = isCod || paymentMethod === 'cod' || (body.payment_method || '').toLowerCase() === 'cod';

    // E. Insert customer_bills and customer_bill_items ONLY for prepaid orders (NEVER for COD or postpaid)
    if (!isPostpaidOrder && !isCodOrder && paymentType === 'prepaid') {
      await this.insertPrepaidBillingRecords(customerId, onetimeGroups, walletTransactionsToInsert, referenceId, paymentMethod);
    }

    // Send notifications
    try {
      if (orderedProductNames.length > 0) {
        const productsString = orderedProductNames.join(', ');
        await this.pushNotificationService.sendNotificationToUsers(
          [customerId],
          {
            title: 'Order Placed Successfully! 🎉',
            body: `Your order for ${productsString} has been successfully placed.`,
          },
        );
      }
    } catch (error) {
      this.developer.error('Order push notification failed', { customerId, error });
    }

    try {
      if (orderedProductNames.length > 0) {
        const productsString = orderedProductNames.join(', ');
        await this.notificationService.sendNotification({
          title: 'Order Placed Successfully! 🎉',
          message: `Your order for ${productsString} has been placed and will be delivered soon.`,
          type: 'success',
          priority: 'medium',
          recipientIds: [customerId],
          senderId: customerId,
        });
      }
    } catch (notifError) {
      this.developer.error('Failed to save checkout notification to DB', { customerId, error: notifError });
    }

    // Order creation status is 'success' if order created without error; payment_status in DB handles payment state
    const finalStatus = referenceId ? 'success' : 'failed';
    const displayId = `#F2H-${referenceId}`;

    return {
      success: true,
      message: 'Checkout processed successfully',
      status: finalStatus,
      id: displayId,
      address: addressLine,
    };
  }

  private async insertWalletTransactions(
    customerId: string,
    walletBalance: number,
    transactions: { amount: number; reference_type: string; reference_id: string; remarks: string }[],
    transaction?: any,
  ): Promise<void> {
    let runningBalance = walletBalance;
    for (const tx of transactions) {
      if (tx.amount > 0) {
        runningBalance = Math.max(0, runningBalance - tx.amount);

        const ts = Math.floor(Date.now() / 1000).toString(36);
        const rnd = Math.floor(Math.random() * 9000 + 1000);
        const txId = `WT${ts}${rnd}`;
        await this.Data.insert(
          'customer_wallet_transactions',
          {
            transaction_id: txId,
            customer_id: customerId,
            transaction_type: 'debit',
            amount: tx.amount,
            balance_after: runningBalance,
            remarks: tx.remarks,
            reference_type: tx.reference_type,
            reference_id: tx.reference_id,
            created_by: customerId,
            created_at: new Date(),
          },
        );
      }
    }
  }

  private async insertPrepaidBillingRecords(
    customerId: string,
    onetimeGroups: Map<string, { deliveryDate: string; deliverySlot: string; items: { item: OnetimeCheckoutItemDto; price: number; qty: number; productName: string }[]; subtotal: number }>,
    walletTransactions: { amount: number; reference_type: string; reference_id: string; remarks: string }[],
    fallbackReferenceId: string | null,
    paymentMethod: string = 'wallet',
    transaction?: any,
  ): Promise<void> {
    const pm = (paymentMethod || '').toLowerCase();
    if (pm === 'cod' || pm === 'postpaid') {
      return;
    }
    for (const [, group] of onetimeGroups) {
      const billId = generateId('BILL', 15);
      const today = new Date().toISOString().split('T')[0];
      const orderRefId = walletTransactions.find(
        (tx) => tx.reference_type === 'order',
      )?.reference_id || fallbackReferenceId;

      try {
        await this.Data.insert(
          'customer_bills',
          {
            bill_id: billId,
            customer_id: customerId,
            bill_type: 'order',
            reference_id: orderRefId,
            payment_type: 'prepaid',
            payment_method: paymentMethod,
            billing_from: group.deliveryDate,
            billing_to: group.deliveryDate,
            due_date: today,
            subtotal: group.subtotal,
            discount_amount: 0,
            tax_amount: 0,
            total_amount: group.subtotal,
            paid_amount: group.subtotal,
            due_amount: 0,
            status: 'paid',
            remarks: 'Prepaid order checkout',
            created_at: new Date(),
            updated_at: new Date(),
          },
        );
      } catch (_) { }

      for (const entry of group.items) {
        const itemTotal = entry.price * entry.qty;
        try {
          await this.Data.insert(
            'customer_bill_items',
            {
              bill_id: billId,
              reference_type: 'order',
              reference_id: orderRefId,
              product_variant_id: entry.item.product_variant_id,
              quantity: entry.qty,
              unit_price: entry.price,
              discount_amount: 0,
              tax_amount: 0,
              total_amount: itemTotal,
              created_at: new Date(),
            },
          );
        } catch (_) { }
      }
    }
  }

  private async broadcastNewOrderToLiveOrders(orderId: string) {
    try {
      const sql = `
        SELECT
          o.order_id,
          o.customer_id,
          o.customer_name,
          o.status,
          o.order_source,
          o.delivery_slot,
          o.address_line,
          o.contact_number,
          o.total_amount,
          o.delivery_partner_id,
          o.assignment_method,
          o.assigned_at,
          o.scheduled_date,
          o.created_at,
          o.branch_id,
          b.branch_name,
          COALESCE(NULLIF(TRIM(db.full_name), ''), NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.user_name) AS partner_name,
          COALESCE(NULLIF(TRIM(db.phone), ''), NULLIF(TRIM(u.phone), ''), NULLIF(TRIM(db.email), ''), NULLIF(TRIM(u.email), ''), '—') AS partner_phone,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', oi.id,
                  'product_name', COALESCE(p.name, oi.product_name, 'Fresh Item'),
                  'variant_name', pv.name,
                  'quantity', oi.quantity,
                  'unit_price', oi.unit_price,
                  'final_price', COALESCE(oi.final_price, oi.total_price, oi.unit_price * oi.quantity)
                )
              )
              FROM order_items oi
              LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
              LEFT JOIN products p ON p.product_id = pv.product_id
              WHERE oi.order_id = o.order_id
            ), '[]'::json
          ) AS items
        FROM orders o
        LEFT JOIN delivery_partners db ON (db.delivery_partner_id = o.delivery_partner_id OR db.user_id = o.delivery_partner_id)
        LEFT JOIN users u ON u.user_id = o.delivery_partner_id
        LEFT JOIN branches b ON b.branch_id = o.branch_id
        WHERE o.order_id = $1 OR o.id::text = $1
        LIMIT 1
      `;
      const rows = await this.db.query(sql, [orderId]);
      if (rows && rows.length > 0) {
        const orderData = rows[0];
        const gateway = this.notificationService.getGateway();
        if (gateway && typeof gateway.emitOrderCreated === 'function') {
          gateway.emitOrderCreated(orderData);
        }
      }
    } catch (err) {
      this.developer.error('broadcastNewOrderToLiveOrders error', { err });
    }
  }
}
