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
import { CustomerPaymentService } from '../../payment/payment.service';

import { FirstOrderDetectorService } from '../../referral/services/first-order-detector.service';
import { ReferralRewardEngineService } from '../../referral/services/referral-reward-engine.service';
import { DiscountEngineService } from 'src/shared/services/discount-engine.service';

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
    private readonly discountEngine: DiscountEngineService,
    private readonly customerPaymentService: CustomerPaymentService,
  ) { }

  async syncCart(body: CartDto, customerId: string) {
    const items = body.items || [];
    let itemsSubtotal = 0;

    if (!customerId) {
      throw new BadRequestException('Authenticated customer is required');
    }

    await this.Data.upsert(
      'carts',
      {
        user_id: customerId,
        cart_data: JSON.stringify(items),
        created_at: new Date(),
        updated_at: new Date(),
      },
      { user_id: customerId },
      {
        cart_data: JSON.stringify(items),
        updated_at: new Date(),
      },
    );

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
      billSummary: await this.calculateBillSummary(itemsSubtotal, customerId),
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
      billSummary: await this.calculateBillSummary(itemsSubtotal, userId),
    };
  }

  private calculateItemSubtotal(item: any, product: any): number {
    // An unknown or unpriced variant contributes nothing to the displayed subtotal.
    // It used to contribute a hardcoded ₹150 — which also mispriced genuinely free
    // items, since the fallback triggered on a price of 0. Checkout rejects such a
    // line outright; this is only the cart preview.
    const price = product?.price == null ? 0 : Number(product.price);
    const qty = item.onetime_details?.quantity || item.quantity || 1;
    return price * qty;
  }

  private async calculateBillSummary(itemsSubtotal: number, customerId?: string) {
    let baseDeliveryFee = 60.0;
    let freeDeliveryThreshold = 199.0;
    let freeDeliveryFirstOrder = true;
    let taxesAndHandling = 10.0;
    try {
      const rows = await this.db.query(
        `SELECT config_data FROM system_configurations WHERE config_key = 'delivery_rules' LIMIT 1`,
      );
      if (rows?.[0]?.config_data) {
        const rules = rows[0].config_data;
        if (rules.base_delivery_fee != null) baseDeliveryFee = Number(rules.base_delivery_fee);
        if (rules.free_delivery_threshold != null) freeDeliveryThreshold = Number(rules.free_delivery_threshold);
        if (rules.free_delivery_first_order != null) freeDeliveryFirstOrder = rules.free_delivery_first_order !== false;
        if (rules.taxes_and_handling_fee != null) taxesAndHandling = Number(rules.taxes_and_handling_fee);
      }
    } catch (_) {}

    let isFirstOrder = false;
    if (customerId && freeDeliveryFirstOrder) {
      try {
        const custRows = await this.db.query(
          `SELECT first_order_completed FROM customers WHERE customer_id = $1 LIMIT 1`,
          [customerId],
        );
        isFirstOrder = custRows?.[0]?.first_order_completed !== true;
      } catch (_) {}
    }

    const isFreeDelivery = (itemsSubtotal >= freeDeliveryThreshold && freeDeliveryThreshold > 0) || isFirstOrder;
    const deliveryPartnerFee = itemsSubtotal > 0 ? (isFreeDelivery ? 0.0 : baseDeliveryFee) : 0.0;
    const effectiveTaxes = itemsSubtotal > 0 ? taxesAndHandling : 0.0;
    const grandTotal = itemsSubtotal > 0 ? itemsSubtotal + deliveryPartnerFee + effectiveTaxes : 0.0;

    return {
      itemsSubtotal,
      deliveryPartnerFee,
      taxesAndHandling: effectiveTaxes,
      grandTotal,
    };
  }

  async checkout(body: CheckOutDto, req?: any) {
    const plan = await this.buildCheckoutPlan(body, req);
    let consumedOnlineTxn: any = null;

    // ── Online payment gate ──
    // When the customer paid via Razorpay (payment_method 'online' or 'upi'),
    // the client sends back the three Razorpay identifiers. We verify and lock
    // the payment *before* the database transaction so a signature failure never
    // leaves an uncommitted order row.
    const isOnlinePayment = ['online', 'upi'].includes(plan.paymentMethod);
    if (isOnlinePayment) {
      if (!body.razorpay_order_id) {
        throw new BadRequestException(
          'razorpay_order_id is required for online payment checkout.',
        );
      }
      // consumeOrderPayment verifies the signature (if not yet verified) and
      // atomically marks the payment row as fulfilled so it can only be used once.
      consumedOnlineTxn = await this.customerPaymentService.consumeOrderPayment({
        customerId: plan.customerId,
        razorpayOrderId: body.razorpay_order_id,
        razorpayPaymentId: body.razorpay_payment_id,
        razorpaySignature: body.razorpay_signature,
        expectedAmount: plan.onetimeTotal,
        orderReference: 'CHECKOUT_PENDING',
      });
    }

    // Everything that moves money or creates an order happens inside one
    // transaction. Previously these were separate autocommitted statements, so a
    // failure after the wallet UPDATE — a constraint violation, a pool timeout, a
    // process restart — left the customer charged with no order and no ledger row.
    const result = await this.Data.executeTransaction(async (tx) => {
      // Concurrency lock on customer to serialize checkout and prevent promotion/coupon race conditions
      await tx.query(
        `SELECT customer_id FROM customers WHERE customer_id = $1 FOR UPDATE`,
        [plan.customerId],
      );

      // Concurrency lock on coupon if applied
      if (plan.discountResolution?.summary?.coupon_id) {
        await tx.query(
          `SELECT coupon_id, used_count FROM coupons WHERE coupon_id = $1 FOR UPDATE`,
          [plan.discountResolution.summary.coupon_id],
        );
      }

      let balanceBeforeDebit = plan.walletBalance;

      if (plan.debitWallet && plan.onetimeTotal > 0) {
        // A single conditional statement: read-modify-write in JS let two
        // concurrent checkouts both pass the balance check and both write, so a
        // customer could spend more than they held.
        const [rows] = await tx.query(
          `UPDATE customers
              SET wallet_balance = wallet_balance - $1,
                  updated_at = NOW()
            WHERE customer_id = $2
              AND wallet_balance >= $1
        RETURNING wallet_balance`,
          [plan.onetimeTotal, plan.customerId],
        );

        if (!rows?.length) {
          throw new BadRequestException(
            'Insufficient wallet balance. Please top up your wallet.',
          );
        }

        // Derive the ledger's running balance from what the database actually
        // committed, never from the pre-read snapshot.
        plan.newBalance = Number(rows[0].wallet_balance);
        balanceBeforeDebit = plan.newBalance + plan.onetimeTotal;
      }

      const orderedProductNames: string[] = [];
      const walletTransactionsToInsert: {
        amount: number;
        reference_type: string;
        reference_id: string;
        remarks: string;
      }[] = [];
      const createdOrderIds: string[] = [];
      let referenceId: string | null = null;

      for (const group of plan.groups) {
        const orderId = generateId('Ord', 15);
        if (!referenceId) referenceId = orderId;
        createdOrderIds.push(orderId);

        const gstAmount = 0;
        const totalAmount = group.totalAmount + gstAmount;

        const orderInsert = await this.Data.insert(
          'orders',
          {
            order_id: orderId,
            customer_id: plan.customerId,
            address_id: plan.addressId,
            branch_id: plan.branchId,
            address_line: plan.addressLine,
            contact_number: plan.contactNumber,
            customer_name: plan.customerName,
            order_source: 'one-time',
            delivery_slot:
              group.deliverySlot.toLowerCase() === 'morning' ? 'morning' : 'evening',
            scheduled_date: group.deliveryDate,
            status: 'placed',
            subtotal: group.subtotal,
            discount_amount: group.discountAmount,
            gst_amount: gstAmount,
            total_amount: totalAmount,
            payment_mode:
              plan.paymentMethod === 'cod'
                ? 'cod'
                : plan.paymentType === 'postpaid'
                  ? 'postpaid'
                  : plan.paymentMethod,
            payment_status:
              plan.paymentType === 'postpaid' || plan.isCod ? 'pending' : 'paid',
            created_at: new Date(),
            updated_at: new Date(),
          },
          { transaction: tx },
        );

        if (!orderInsert?.status) {
          throw new Error(
            `Failed to create order record for group: ${group.deliveryDate}/${group.deliverySlot}`,
          );
        }

        for (const entry of group.items) {
          if (entry.productName) orderedProductNames.push(entry.productName);

          const itemInsert = await this.Data.insert(
            'order_items',
            {
              order_id: orderId,
              variant_id: entry.item.product_variant_id,
              product_name: entry.productName,
              unit_price: entry.price,
              original_price: entry.originalPrice,
              quantity: entry.qty,
              promotion_id: entry.promotionId,
              coupon_id: entry.couponId,
              discount_amount: entry.discountAmount * entry.qty,
              coupon_amount: entry.couponAmount * entry.qty,
              total_price: entry.lineTotal,
              is_free: false,
              created_at: new Date(),
            },
            { transaction: tx },
          );

          if (!itemInsert?.status) {
            throw new Error(
              `Failed to create order item for variant: ${entry.item.product_variant_id}`,
            );
          }
        }

        // Record redemptions inside transaction
        const groupItemResults = group.items.map((entry) => ({
          variant_id: entry.item.product_variant_id,
          original_price: entry.originalPrice,
          unit_price: entry.price,
          promotion_id: entry.promotionId,
          coupon_id: entry.couponId,
          discount_amount: entry.discountAmount,
          coupon_amount: entry.couponAmount,
          final_price: entry.finalPrice,
          item_line_total: entry.lineTotal,
        }));
        const groupItemsList = group.items.map((entry) => ({
          variant_id: entry.item.product_variant_id,
          quantity: entry.qty,
        }));

        let couponPromoId: string | null = null;
        if (plan.discountResolution?.summary?.coupon_id && plan.couponCode) {
          couponPromoId = await this.discountEngine.getCouponPromotionId(plan.couponCode);
        }

        const groupCouponDiscount = group.items.reduce(
          (sum, entry) => sum + entry.couponAmount * entry.qty,
          0,
        );

        await this.discountEngine.recordRedemptions(
          tx,
          orderId,
          plan.customerId,
          groupItemResults,
          groupItemsList,
          plan.discountResolution?.summary?.coupon_id || null,
          couponPromoId,
          groupCouponDiscount,
        );

        walletTransactionsToInsert.push({
          amount: totalAmount,
          reference_type: 'order',
          reference_id: orderId,
          remarks:
            plan.paymentType === 'postpaid'
              ? 'Checkout postpaid order placement'
              : 'Checkout order placement',
        });
      }

      // Cart persistence is part of the same commit: leaving it best-effort meant a
      // customer could pay and still see the purchased items in their cart.
      this.Data.assertWritten(
        await this.Data.upsert(
          'carts',
          {
            user_id: plan.customerId,
            cart_data: JSON.stringify(plan.remainingCartItems),
            updated_at: new Date(),
          },
          { user_id: plan.customerId },
          {
            cart_data: JSON.stringify(plan.remainingCartItems),
            updated_at: new Date(),
          },
          { transaction: tx },
        ),
        'Cart update',
      );

      if (plan.debitWallet) {
        await this.insertWalletTransactions(
          plan.customerId,
          balanceBeforeDebit,
          walletTransactionsToInsert,
          tx,
        );
      }

      if (plan.createPrepaidBills) {
        await this.insertPrepaidBillingRecords(
          plan.customerId,
          plan.groups,
          walletTransactionsToInsert,
          referenceId,
          plan.paymentMethod,
          tx,
        );
      }

      return { referenceId, orderedProductNames, createdOrderIds };
    });

    if (['online', 'upi', 'razorpay'].includes(plan.paymentMethod)) {
      if (consumedOnlineTxn?.transaction_id && result.referenceId) {
        await this.customerPaymentService.attachOrderReference(
          consumedOnlineTxn.transaction_id,
          result.referenceId,
        );
      }
    }

    // Side effects run only after the commit. Broadcasting mid-loop showed admins
    // orders that a later failure would have rolled back, and an FCM timeout used
    // to sit on the payment path.
    for (const orderId of result.createdOrderIds) {
      await this.broadcastNewOrderToLiveOrders(orderId);
    }
    await this.sendCheckoutNotifications(plan.customerId, result.orderedProductNames);

    return {
      success: true,
      message: 'Checkout processed successfully',
      status: result.referenceId ? 'success' : 'failed',
      id: `#F2H-${result.referenceId}`,
      address: plan.addressLine,
      discount_amount: plan.groups.reduce((s, g) => s + g.discountAmount, 0),
      total_amount: plan.onetimeTotal,
      coupon_summary: plan.discountResolution?.summary || null,
    };
  }

  /**
   * Resolves and validates everything checkout needs, without writing anything.
   * Keeping all reads here means the transaction below holds its connection for the
   * shortest possible time and contains no logic that can fail on bad input.
   */
  private async buildCheckoutPlan(body: CheckOutDto, req?: any) {
    const customerId = body.customer_id;
    const itemsToCheckout = body.items || [];
    if (!customerId) {
      throw new BadRequestException('Customer ID is required for checkout');
    }

    const {
      addressId,
      addressLine,
      contactNumber,
      addressBranchId,
      contactName,
    } = await this.resolveDeliveryAddress(customerId, body.address_id);

    const customer = await this.resolveCustomer(customerId);

    const branchId = addressBranchId || customer.branch_id || null;
    if (!branchId || branchId === 'ALL') {
      throw new BadRequestException(
        'Unable to determine delivery branch for this address. Please select a valid delivery address.',
      );
    }

    const customerName =
      contactName ||
      customer.full_name ||
      `${customer.first_name || ''} ${customer.last_name || ''}`.trim() ||
      'Customer';

    const remainingCartItems = await this.loadRemainingCartItems(
      customerId,
      itemsToCheckout,
    );

    // One batched lookup instead of a query per cart line on the payment path.
    const variantIds = Array.from(
      new Set(itemsToCheckout.map((item) => item.product_variant_id).filter(Boolean)),
    );
    const variantRows = variantIds.length
      ? await this.db.query(
          `SELECT pv.variant_id, pv.price, pv.original_price, p.name AS product_name
             FROM product_variants pv
             LEFT JOIN products p ON pv.product_id = p.product_id
            WHERE pv.variant_id = ANY($1)`,
          [variantIds],
        )
      : [];
    const variantById = new Map(
      (variantRows || []).map((row: any) => [row.variant_id, row]),
    );

    // Every line is validated before anything is written, and all bad lines are
    // reported at once. An unknown or unpriced variant used to fall back to a
    // hardcoded ₹150 — which also mispriced a legitimately free item, because the
    // fallback triggered on a price of 0.
    const unavailable = itemsToCheckout
      .filter((item) => {
        const row = variantById.get(item.product_variant_id);
        return !row || row.price === null || row.price === undefined;
      })
      .map((item) => item.product_variant_id);

    if (unavailable.length) {
      throw new BadRequestException(
        `These products are unavailable: ${unavailable.join(', ')}`,
      );
    }

    // Resolve discounts & coupons for one-time checkout
    const discountItems = itemsToCheckout.map((item) => {
      const row = variantById.get(item.product_variant_id);
      const onetimeItem = item as OnetimeCheckoutItemDto;
      const qty = onetimeItem.onetime_details?.quantity || item.quantity || 1;
      const price = Number(row?.price || 0);
      const origPrice = Number(row?.original_price || price);
      return {
        variant_id: item.product_variant_id,
        unit_price: price,
        original_price: origPrice,
        quantity: qty,
      };
    });

    const discountResolution = await this.discountEngine.resolveDiscounts({
      customer_id: customerId,
      order_source: 'one-time',
      coupon_code: body.coupon_code || null,
      items: discountItems,
    });

    const discountByVariantId = new Map(
      discountResolution.item_results.map((r) => [r.variant_id, r]),
    );

    type OnetimeEntry = {
      item: OnetimeCheckoutItemDto;
      price: number;
      originalPrice: number;
      qty: number;
      productName: string;
      promotionId: string | null;
      couponId: string | null;
      discountAmount: number;
      couponAmount: number;
      finalPrice: number;
      lineTotal: number;
    };
    type OnetimeGroup = {
      deliveryDate: string;
      deliverySlot: string;
      items: OnetimeEntry[];
      subtotal: number;
      discountAmount: number;
      totalAmount: number;
    };

    const paymentMethod = body.payment_method || 'wallet';
    const isCod = paymentMethod === 'cod';
    const paymentType = body.payment_type || (isCod ? 'postpaid' : 'prepaid');

    const groupsByKey = new Map<string, OnetimeGroup>();
    for (const item of itemsToCheckout) {
      const row = variantById.get(item.product_variant_id);
      const price = Number(row.price);
      const originalPrice = Number(row.original_price || price);
      const productName = row.product_name || 'Product';
      const onetimeItem = item as OnetimeCheckoutItemDto;
      const qty = onetimeItem.onetime_details?.quantity || 1;

      const disc = discountByVariantId.get(item.product_variant_id);
      const unitDiscount = disc?.discount_amount || 0;
      const unitCoupon = disc?.coupon_amount || 0;
      const finalPrice = Math.max(0, price - unitDiscount - unitCoupon);
      const lineTotal = finalPrice * qty;

      const deliveryDate =
        onetimeItem.onetime_details?.delivery_date ||
        new Date().toISOString().split('T')[0];
      const deliverySlot = onetimeItem.onetime_details?.delivery_slot || 'Morning';
      const groupKey = `${deliveryDate}_${deliverySlot.toLowerCase()}`;

      if (!groupsByKey.has(groupKey)) {
        groupsByKey.set(groupKey, {
          deliveryDate,
          deliverySlot,
          items: [],
          subtotal: 0,
          discountAmount: 0,
          totalAmount: 0,
        });
      }
      const group = groupsByKey.get(groupKey)!;
      group.items.push({
        item: onetimeItem,
        price,
        originalPrice,
        qty,
        productName,
        promotionId: disc?.promotion_id || null,
        couponId: disc?.coupon_id || null,
        discountAmount: unitDiscount,
        couponAmount: unitCoupon,
        finalPrice,
        lineTotal,
      });
      group.subtotal += price * qty;
      group.discountAmount += (unitDiscount + unitCoupon) * qty;
      group.totalAmount += lineTotal;
    }

    const groups = Array.from(groupsByKey.values());
    const onetimeTotal = groups.reduce((sum, group) => sum + group.totalAmount, 0);
    const walletBalance = Number(customer.wallet_balance || 0);

    const isPostpaidOrder =
      paymentType === 'postpaid' ||
      paymentMethod === 'postpaid' ||
      (body.payment_type || '').toLowerCase() === 'postpaid';

    return {
      customerId,
      addressId,
      addressLine,
      contactNumber: contactNumber || customer.phone || '',
      branchId,
      customerName,
      remainingCartItems,
      groups,
      onetimeTotal,
      walletBalance,
      newBalance: walletBalance,
      paymentMethod,
      paymentType,
      isCod,
      couponCode: body.coupon_code || null,
      discountResolution,
      debitWallet: paymentMethod === 'wallet' && !isCod && paymentType === 'prepaid',
      createPrepaidBills: !isPostpaidOrder && !isCod && paymentType === 'prepaid',
    };
  }

  private async resolveDeliveryAddress(customerId: string, requestedAddressId?: string) {
    const select = [
      'address_id',
      'address_line',
      'contact_mobile',
      'branch_id',
      'contact_name',
    ];

    let addr: any = null;
    if (requestedAddressId) {
      const result = await this.Data.query('customer_addresses', {
        select,
        where: [
          { column: 'address_id', operator: '=', value: requestedAddressId },
          { column: 'customer_id', operator: '=', value: customerId },
        ],
        limit: 1,
      });
      addr = result?.data?.[0] ?? null;

      if (!addr) {
        const fallback = await this.Data.query('customer_addresses', {
          select,
          where: [
            { column: 'customer_id', operator: '=', value: customerId },
            { column: 'is_default', operator: '=', value: true },
          ],
          limit: 1,
        });
        addr = fallback?.data?.[0] ?? null;
      }
    }

    if (!addr) {
      throw new BadRequestException(
        'Delivery address not found. Please add an address before checking out.',
      );
    }

    return {
      addressId: addr.address_id,
      addressLine: addr.address_line || '',
      contactNumber: addr.contact_mobile || '',
      addressBranchId: addr.branch_id || null,
      contactName: addr.contact_name || '',
    };
  }

  /**
   * Looks the customer up strictly by id. The previous query also matched on the
   * token's email (`... OR u.email = $2`) with `LIMIT 1` and no ORDER BY, so when
   * the id had no `customers` row it could return a different customer entirely —
   * and checkout would then debit that customer's wallet.
   */
  private async resolveCustomer(customerId: string) {
    const sql = `
      SELECT
        c.customer_id,
        c.wallet_balance,
        c.branch_id,
        c.is_postpaid_enabled,
        c.postpaid_credit_limit,
        -- customers has no full_name column; the name lives on users. Same
        -- derivation this file already uses for partner_name below.
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
          u.user_name
        ) AS full_name,
        u.first_name,
        u.last_name,
        u.user_name,
        u.phone,
        u.email
      FROM customers c
      JOIN users u ON u.user_id = c.customer_id
      WHERE c.customer_id = $1
      LIMIT 1
    `;

    const existing = await this.db.query(sql, [customerId]);
    if (existing?.[0]) return existing[0];

    // The account exists but has no customer profile yet — create one, then re-read.
    const userRes = await this.Data.query('users', {
      where: [{ column: 'user_id', operator: '=', value: customerId }],
      limit: 1,
    });
    if (!userRes?.data?.[0]) {
      throw new BadRequestException('Customer profile not found');
    }

    const activeBranchRes = await this.Data.query('branches', {
      where: [{ column: 'is_active', operator: '=', value: true }],
      limit: 1,
    });
    const now = new Date();
    await this.Data.insert('customers', {
      customer_id: customerId,
      branch_id: activeBranchRes?.data?.[0]?.branch_id || 'BRANCH_KUPPAM_01',
      wallet_balance: 0,
      // customer_status was dropped from customers; is_blocked is the live flag
      // and its default (unblocked) already means active.
      created_at: now,
      updated_at: now,
    });

    const created = await this.db.query(sql, [customerId]);
    if (!created?.[0]) {
      throw new BadRequestException('Customer profile not found');
    }
    return created[0];
  }

  private async loadRemainingCartItems(
    customerId: string,
    itemsToCheckout: { product_variant_id: string }[],
  ): Promise<any[]> {
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
    } catch (error) {
      // A stored cart that will not parse is recoverable: checkout proceeds and the
      // cart is rewritten with the remaining items. Logged so a persistent
      // corruption is still visible.
      this.developer.warn('Could not read existing cart before checkout', {
        customerId,
        error,
      });
      currentCartItems = [];
    }

    const checkoutSet = new Set(
      itemsToCheckout.map((item) => item.product_variant_id),
    );
    return currentCartItems.filter(
      (item: any) => !checkoutSet.has(item.product_variant_id),
    );
  }

  private async sendCheckoutNotifications(
    customerId: string,
    orderedProductNames: string[],
  ): Promise<void> {
    if (!orderedProductNames.length) return;
    const productsString = orderedProductNames.join(', ');

    try {
      await this.pushNotificationService.sendNotificationToUsers([customerId], {
        title: 'Order Placed Successfully! 🎉',
        body: `Your order for ${productsString} has been successfully placed.`,
      });
    } catch (error) {
      this.developer.error('Order push notification failed', { customerId, error });
    }

    try {
      await this.notificationService.sendNotification({
        title: 'Order Placed Successfully! 🎉',
        message: `Your order for ${productsString} has been placed and will be delivered soon.`,
        type: 'success',
        priority: 'medium',
        recipientIds: [customerId],
        senderId: customerId,
      });
    } catch (error) {
      this.developer.error('Failed to save checkout notification to DB', {
        customerId,
        error,
      });
    }
  }

  /**
   * Writes the wallet ledger rows for a completed checkout.
   *
   * @param balanceBeforeDebit the balance the database held immediately before the
   *   atomic debit, derived from that statement's RETURNING value. Using the
   *   pre-read JS snapshot recorded a `balance_after` that never existed.
   */
  private async insertWalletTransactions(
    customerId: string,
    balanceBeforeDebit: number,
    transactions: { amount: number; reference_type: string; reference_id: string; remarks: string }[],
    transaction: any,
  ): Promise<void> {
    let runningBalance = balanceBeforeDebit;

    for (const tx of transactions) {
      if (tx.amount <= 0) continue;
      runningBalance -= tx.amount;

      const ts = Math.floor(Date.now() / 1000).toString(36);
      const rnd = Math.floor(Math.random() * 9000 + 1000);

      this.Data.assertWritten(
        await this.Data.insert(
          'customer_wallet_transactions',
          {
            transaction_id: `WT${ts}${rnd}`,
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
          { transaction },
        ),
        'Wallet ledger entry',
      );
    }
  }

  private async insertPrepaidBillingRecords(
    customerId: string,
    groups: { deliveryDate: string; deliverySlot: string; items: { item: OnetimeCheckoutItemDto; price: number; qty: number; productName: string }[]; subtotal: number }[],
    walletTransactions: { amount: number; reference_type: string; reference_id: string; remarks: string }[],
    fallbackReferenceId: string | null,
    paymentMethod: string,
    transaction: any,
  ): Promise<void> {
    const pm = (paymentMethod || '').toLowerCase();
    if (pm === 'cod' || pm === 'postpaid') return;

    const today = new Date().toISOString().split('T')[0];

    for (const group of groups) {
      const billId = generateId('BILL', 15);
      const orderRefId =
        walletTransactions.find((tx) => tx.reference_type === 'order')?.reference_id ||
        fallbackReferenceId;

      // No try/catch here on purpose: a bill that fails to write must roll the whole
      // checkout back rather than leave the customer charged with no invoice.
      this.Data.assertWritten(
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
          { transaction },
        ),
        'Customer bill',
      );

      for (const entry of group.items) {
        this.Data.assertWritten(
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
              total_amount: entry.price * entry.qty,
              created_at: new Date(),
            },
            { transaction },
          ),
          'Customer bill item',
        );
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
          o.subtotal,
          o.discount_amount,
          o.gst_amount,
          o.total_amount,
          o.delivery_partner_id,
          o.assignment_method,
          o.assigned_at,
          o.scheduled_date,
          o.created_at,
          o.branch_id,
          b.branch_name,
          -- delivery_partners carries no name/phone/email: delivery_partner_id is
          -- the users.user_id, so contact details come from the users join below.
          COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.user_name) AS partner_name,
          COALESCE(NULLIF(TRIM(u.phone), ''), NULLIF(TRIM(u.email), ''), '—') AS partner_phone,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', oi.id,
                  'product_name', COALESCE(p.name, oi.product_name, 'Fresh Item'),
                  'variant_name', pv.name,
                  'quantity', oi.quantity,
                  'unit_price', oi.unit_price,
                  'discount_amount', oi.discount_amount,
                  'coupon_amount', oi.coupon_amount,
                  'total_price', oi.total_price,
                  'is_free', oi.is_free,
                  'final_price', COALESCE(
                    NULLIF(oi.total_price, 0),
                    NULLIF(oi.final_price, 0),
                    GREATEST(
                      oi.unit_price * oi.quantity
                        - COALESCE(oi.discount_amount, 0)
                        - COALESCE(oi.coupon_amount, 0),
                      0
                    )
                  )
                )
              )
              FROM order_items oi
              LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
              LEFT JOIN products p ON p.product_id = pv.product_id
              WHERE oi.order_id = o.order_id
            ), '[]'::json
          ) AS items
        FROM orders o
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

  async validateCoupon(customerId: string, couponCode: string, subtotal: number) {
    if (!couponCode) {
      throw new BadRequestException('Coupon code is required');
    }
    return this.discountEngine.validateCouponCode(couponCode.trim(), customerId, subtotal || 0);
  }

  async listCoupons(customerId: string, subtotal: number) {
    const coupons = await this.discountEngine.listAvailableCoupons(
      customerId,
      subtotal || 0,
    );
    return { status: true, data: coupons };
  }

  async previewDiscounts(customerId: string, body: CheckOutDto) {
    body.customer_id = customerId;
    try {
      const rawItems = Array.isArray(body.items) ? body.items : [];
      let itemsToCheckout: any[] = rawItems;
      if (itemsToCheckout.length === 0 && customerId) {
        const cartRes = await this.getCartItems(customerId);
        itemsToCheckout = (cartRes?.items || []).map((ci: any) => ({
          product_id: ci.cart_data?.product_id || '',
          product_variant_id: ci.cart_data?.product_variant_id || ci.variant_id,
          quantity: ci.cart_data?.quantity || ci.quantity || 1,
          purchase_type: 'onetime',
          onetime_details: ci.cart_data?.onetime_details || { quantity: ci.cart_data?.quantity || 1 },
        }));
      }

      const variantIds = Array.from(
        new Set(itemsToCheckout.map((item: any) => item.product_variant_id).filter(Boolean)),
      );

      const variantRows = variantIds.length
        ? await this.db.query(
            `SELECT pv.variant_id, pv.price, pv.original_price, p.name AS product_name
               FROM product_variants pv
               LEFT JOIN products p ON pv.product_id = p.product_id
              WHERE pv.variant_id = ANY($1)`,
            [variantIds],
          )
        : [];

      const variantById = new Map(
        (variantRows || []).map((row: any) => [row.variant_id, row]),
      );

      const discountItems = itemsToCheckout.map((item: any) => {
        const row = variantById.get(item.product_variant_id);
        const qty = item.onetime_details?.quantity || item.quantity || 1;
        const price = Number(row?.price || 0);
        const origPrice = Number(row?.original_price || price);
        return {
          variant_id: item.product_variant_id,
          unit_price: price,
          original_price: origPrice,
          quantity: qty,
        };
      });

      const discountResolution = await this.discountEngine.resolveDiscounts({
        customer_id: customerId,
        order_source: 'one-time',
        coupon_code: body.coupon_code || null,
        items: discountItems,
      });

      const subtotal = discountItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      const totalDiscount = discountResolution?.summary?.total_discount || 0;
      const finalAmount = Math.max(0, subtotal - totalDiscount);

      return {
        subtotal,
        discount_amount: totalDiscount,
        total_amount: finalAmount,
        coupon_summary: discountResolution?.summary || null,
      };
    } catch (err) {
      this.developer.error('previewDiscounts calculation error', { err });
      const rawItems = Array.isArray(body.items) ? body.items : [];
      const subtotal = rawItems.reduce((s: number, i: any) => s + Number(i.price || 0) * (i.quantity || 1), 0);
      return {
        subtotal,
        discount_amount: 0,
        total_amount: subtotal,
        coupon_summary: null,
      };
    }
  }
}
