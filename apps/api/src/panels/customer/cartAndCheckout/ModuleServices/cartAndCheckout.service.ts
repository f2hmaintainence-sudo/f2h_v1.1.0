import { BadRequestException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import {
  CreateCartDto,
  DeveloperSubscriptionItemDto,
  CartDto,
  CheckOutDto,
  OnetimeCheckoutItemDto,
  SubscriptionCheckoutItemDto,
} from '../dto/cart.dto';
import { generateId } from 'src/helpers/RandomHelper';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';
import { NotificationService } from 'src/notifications/notification.service';
import * as crypto from 'crypto';

const ROUTE_CAPACITY = 120;
const DEFAULT_BRANCH_ID = 'ALL';

function calculateEstimatedDeliveryDays(startDate: Date, endDate: Date, activeWeekdays: number[]): number {
  if (activeWeekdays.length === 0) return 0;
  let count = 0;
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  while (current <= end) {
    const schedDay = (current.getDay() + 6) % 7;
    if (activeWeekdays.includes(schedDay)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

@Injectable()
export class CartService {
  constructor(
    private readonly db: DatabaseService,
    private readonly Data: DataService,
    private readonly developer: DeveloperService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly notificationService: NotificationService,
  ) { }

  async syncCart(body: CartDto) {
    // console.log("body into cart-sync", JSON.stringify(body.items, null, 2))
    // console.log("=== [Cart Service] syncCart customer_id:", body.customer_id);
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

    const variantIds = items.map(item => item.product_variant_id).filter(Boolean);
    const productsByVariantId: Record<string, any> = {};
    if (variantIds.length > 0) {
      const queryResult = await this.db.query(
        `SELECT variant_id, price, subscription_price FROM product_variants WHERE variant_id = ANY($1)`,
        [variantIds]
      );
      for (const row of queryResult || []) {
        productsByVariantId[row.variant_id] = row;
      }
    }

    for (const item of items) {
      const product = productsByVariantId[item.product_variant_id];
      if (!product) {
         console.log("product_price not found for variant:", item.product_variant_id);
      }
      itemsSubtotal += this.calculateItemSubtotal(item, product);
    }

    return {
      billSummary: this.calculateBillSummary(itemsSubtotal),
    };
  }

  async getCartItems(userId: string) {
    // console.log("userId into getCartItems", JSON.stringify(userId, null, 2))
    const result = await this.Data.query('carts', {
      select: [
        'user_id',
        'cart_data',
        'created_at',
        'updated_at',
      ],
      where: [
        { column: 'user_id', operator: '=', value: userId },
      ],
    });
    const cartData = result?.data?.[0];
    const items = cartData
      ? (typeof cartData.cart_data === 'string' ? JSON.parse(cartData.cart_data) : cartData.cart_data)
      : [];
    let itemsSubtotal = 0;
    const formattedItems: any[] = [];

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

    const variantIds = items.map((item: any) => item.product_variant_id).filter(Boolean);
    const productsByVariantId: Record<string, any> = {};
    if (variantIds.length > 0) {
      const queryResult = await this.db.query(
        `SELECT 
          pv.*, 
          p.name AS product_name, 
          p.is_subscribable, 
          p.is_one_time, 
          pi.url AS image_path
         FROM product_variants pv
         LEFT JOIN products p ON pv.product_id = p.product_id
         LEFT JOIN product_images pi ON pv.variant_id = pi.variant_id
         WHERE pv.variant_id = ANY($1) AND pv.status = 'active'`,
        [variantIds]
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
          subscription_price: product?.subscription_price,
          unit_value: product?.unit_value,
          unit_type: product?.unit_type,
          status: product?.status,
          is_out_of_stock: product?.is_out_of_stock,
          manageable_qty: product?.manageable_qty,
          sort_order: product?.sort_order,
          image_path: mapImagePath(product?.image_path),
          is_subscribable: product?.is_subscribable,
          is_one_time: product?.is_one_time,
        }
      });
    }

    return {
      items: formattedItems,
      billSummary: this.calculateBillSummary(itemsSubtotal),
    };
  }

  private calculateItemSubtotal(item: any, product: any): number {
    const price = product?.price ? Number(product.price) : 150;
    const subscriptionPrice = (product?.subscription_price && Number(product.subscription_price) > 0)
      ? Number(product.subscription_price)
      : (price * 0.85);

    if (item.purchase_type === 'onetime') {
      const qty = item.onetime_details?.quantity || 1;
      return price * qty;
    } else if (item.purchase_type === 'subscription') {
      const schedules = item.subscription_details?.schedules || [];
      let weeklyQty = 0;
      for (const s of schedules) {
        weeklyQty += (s.m_quantity || 0) + (s.e_quantity || 0);
      }
      return subscriptionPrice * weeklyQty;
    }
    return 0;
  }

  private calculateBillSummary(itemsSubtotal: number) {
    const deliveryPartnerFee = itemsSubtotal > 0 ? 29.0 : 0.0;
    const taxesAndHandling = itemsSubtotal > 0 ? 12.0 : 0.0;
    const grandTotal = itemsSubtotal > 0 ? (itemsSubtotal + deliveryPartnerFee + taxesAndHandling) : 0.0;

    return {
      itemsSubtotal,
      deliveryPartnerFee,
      taxesAndHandling,
      grandTotal,
    };
  }

  async checkout(body: CheckOutDto) {
    const customerId = body.customer_id;
    const itemsToCheckout = body.items || [];
    if (!customerId) {
      throw new BadRequestException(
        'Customer ID is required for checkout',
      );
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
        const addressResult = await this.Data.query('customer_addresses', {
          select: ['address_id', 'address_line', 'contact_mobile', 'branch_id', 'contact_name'],
          where: [
            { column: 'customer_id', operator: '=', value: customerId },
            { column: 'is_default', operator: '=', value: true },
          ],
          limit: 1,
        });
        const addr = addressResult?.data?.[0];
        if (addr) {
          addressId = addr.address_id;
          addressLine = addr.address_line || '';
          contactNumber = addr.contact_mobile || '';
          addressBranchId = addr.branch_id || null;
          customerName = addr.contact_name || '';
        }
      }
    }

    if (!addressId) {
      console.error('[Checkout] BadRequestException: Delivery address not found');
      throw new BadRequestException('Delivery address not found. Please add an address before checking out.');
    }

    // Resolve Customer Routing info and Wallet balance
    const customerResult = await this.Data.query('customers', {
      select: [
        'wallet_balance',
        'is_postpaid_enabled',
        'postpaid_credit_limit',
        'full_name',
        'first_name',
        'last_name',
        'phone',
        'subscription_number',
      ],
      where: [{ column: 'customer_id', operator: '=', value: customerId }],
      limit: 1,
    });
    const customer = customerResult?.data?.[0];
    if (!customer) {
      console.error('[Checkout] BadRequestException: Customer profile not found for ID', customerId);
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
    let subscriptionNumber = customer.subscription_number || null;
    if (!contactNumber) {
      contactNumber = customer.phone || '';
    }

    // 1. Fetch current cart
    const cartResult = await this.Data.query('carts', {
      select: ['cart_data'],
      where: [{ column: 'user_id', operator: '=', value: customerId }],
    });

    const cartRow = cartResult?.data?.[0];
    const currentCartItems = cartRow
      ? (typeof cartRow.cart_data === 'string' ? JSON.parse(cartRow.cart_data) : cartRow.cart_data || [])
      : [];

    // 2. Create a set of checkout item identifiers: variantId + purchaseType
    const checkoutSet = new Set(
      itemsToCheckout.map((item) => `${item.product_variant_id}_${item.purchase_type}`)
    );

    // 3. Filter out checked out items
    const remainingCartItems = currentCartItems.filter((item) => {
      const key = `${item.product_variant_id}_${item.purchase_type}`;
      return !checkoutSet.has(key);
    });

    // 4. Pre-calculate total amount and build grouping maps
    let totalCheckoutAmount = 0;
    const paymentMethod = body.payment_method || 'wallet';
    const isCod = paymentMethod === 'cod';
    const paymentType = body.payment_type || (isCod ? 'postpaid' : 'prepaid');

    // ── Group one-time items by (delivery_date, delivery_slot) ──
    type OnetimeEntry = { item: OnetimeCheckoutItemDto; price: number; qty: number; productName: string };
    type OnetimeGroup = { deliveryDate: string; deliverySlot: string; items: OnetimeEntry[]; subtotal: number };
    const onetimeGroups = new Map<string, OnetimeGroup>();

    // ── Group subscription items by (start_date, end_date, auto_renew) ──
    type SubEntry = { item: SubscriptionCheckoutItemDto; price: number; productName: string; schedules: any[]; weeklyQty: number };
    type SubGroup = { startDate: Date; endDate: Date; autoRenew: boolean; items: SubEntry[]; subtotal: number };
    const subscriptionGroups = new Map<string, SubGroup>();

    for (const item of itemsToCheckout) {
      if (item.purchase_type === 'onetime') {
        const productDetails = await this.Data.query('product_variants', {
          select: ['product_variants.price', 'products.name AS product_name'],
          joins: [
            {
              type: 'left',
              table: 'products',
              on: [{ column: 'product_variants.product_id', operator: '=', value: 'products.product_id' }],
            },
          ],
          where: [{ column: 'product_variants.variant_id', operator: '=', value: item.product_variant_id }],
          limit: 1,
        });
        const price = productDetails?.data?.[0]?.price ? Number(productDetails.data[0].price) : 150;
        const productName = productDetails?.data?.[0]?.product_name || 'Product';
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
      } else if (item.purchase_type === 'subscription') {
        const productDetails = await this.Data.query('product_variants', {
          select: ['price', 'subscription_price', 'products.name AS product_name'],
          joins: [
            {
              type: 'left',
              table: 'products',
              on: [{ column: 'product_variants.product_id', operator: '=', value: 'products.product_id' }],
            },
          ],
          where: [{ column: 'product_variants.variant_id', operator: '=', value: item.product_variant_id }],
          limit: 1,
        });
        const variant = productDetails?.data?.[0];
        const regularPrice = variant?.price ? Number(variant.price) : 150;
        // const subscriptionPrice = (variant?.subscription_price && Number(variant.subscription_price) > 0)
        //   ? Number(variant.subscription_price)
        //   : (regularPrice * 0.85);
        const subscriptionPrice = variant.subscription_price;
        const productName = variant?.product_name || 'Product';
        const subItem = item as SubscriptionCheckoutItemDto;
        const schedules = subItem.subscription_details?.schedules || [];
        let weeklyQty = 0;
        for (const s of schedules) {
          weeklyQty += (s.m_quantity || 0) + (s.e_quantity || 0);
        }

        const userStartDate = subItem.subscription_details?.start_date;
        const userEndDate = subItem.subscription_details?.end_date;
        const userAutoRenew = subItem.subscription_details?.auto_renew;
        const startDate = userStartDate ? new Date(userStartDate) : new Date();
        let endDate: Date;
        if (userEndDate) {
          endDate = new Date(userEndDate);
        } else {
          const year = startDate.getFullYear();
          const month = startDate.getMonth(); // 0-indexed
          if (paymentType === 'postpaid') {
            // Last day of the next month (2 months: July 17 -> August 31)
            endDate = new Date(year, month + 2, 0);
          } else {
            // Last day of the same month (prepaid: July 17 -> July 31)
            endDate = new Date(year, month + 1, 0);
          }
        }
        const autoRenew = userAutoRenew !== undefined ? userAutoRenew : true;

        let subtotal = 0;
        if (paymentType === 'prepaid') {
          let totalQty = 0;
          for (const s of schedules) {
            const dayQty = (s.m_quantity || 0) + (s.e_quantity || 0);
            if (dayQty > 0) {
              const deliveryDays = calculateEstimatedDeliveryDays(startDate, endDate, [s.day]);
              totalQty += dayQty * deliveryDays;
            }
          }
          subtotal = subscriptionPrice * totalQty;
        } else {
          subtotal = subscriptionPrice * weeklyQty;
        }
        totalCheckoutAmount += subtotal;

        const groupKey = `${startDate.toISOString()}_${endDate.toISOString()}_${autoRenew}`;
        if (!subscriptionGroups.has(groupKey)) {
          subscriptionGroups.set(groupKey, { startDate, endDate, autoRenew, items: [], subtotal: 0 });
        }
        const group = subscriptionGroups.get(groupKey)!;
        group.items.push({ item: subItem, price: subscriptionPrice, productName, schedules, weeklyQty });
        group.subtotal += subtotal;
      }
    }


    // Block COD for subscriptions
    if (isCod && subscriptionGroups.size > 0) {
      throw new BadRequestException('Cash on Delivery is not available for subscriptions. Please use wallet or postpaid.');
    }

    // Calculate separate totals for one-time and subscription items
    let onetimeTotal = 0;
    for (const [, g] of onetimeGroups) onetimeTotal += g.subtotal;
    let subscriptionTotal = 0;
    for (const [, g] of subscriptionGroups) subscriptionTotal += g.subtotal;

    let newBalance = walletBalance;

    // Subscriptions are always postpaid — validate credit limit if paymentType is postpaid
    if (paymentType === 'postpaid' && subscriptionTotal > 0) {
      const isPostpaidEnabled = customer.is_postpaid_enabled === true || customer.is_postpaid_enabled === 'true';
      if (!isPostpaidEnabled) {
        throw new BadRequestException('Postpaid option is not enabled for your profile. Subscriptions require postpaid. Please contact support.');
      }
      const creditLimit = Number(customer.postpaid_credit_limit || 0);
      // Check if subscription amount fits within credit limit (considering current balance)
      const projectedBalance = walletBalance - subscriptionTotal;
      if (projectedBalance < -creditLimit) {
        const availableCredit = creditLimit + walletBalance;
        throw new BadRequestException(`Postpaid credit limit exceeded for subscription. Available credit: ₹${availableCredit >= 0 ? availableCredit.toFixed(2) : '0.00'}`);
      }
    }

    // One-time order payment validation
    if (onetimeTotal > 0) {
      if (paymentMethod === 'wallet') {
        if (walletBalance < onetimeTotal) {
          console.error(`[Checkout] BadRequestException: Insufficient wallet balance. Wallet: ${walletBalance}, Total: ${onetimeTotal}`);
          throw new BadRequestException('Insufficient wallet balance. Please top up your wallet.');
        }
        newBalance = walletBalance - onetimeTotal;
      }
    }
    const orderedProductNames: string[] = [];
    const subscribedProductNames: string[] = [];

    let referenceType: string | null = null;
    let referenceId: string | null = null;

    // Run the checkout transaction
    await this.Data.executeTransaction(async (transaction) => {
      const walletTransactionsToInsert: {
        amount: number;
        reference_type: string;
        reference_id: string;
        remarks: string;
      }[] = [];

      // A. Deduct customer wallet balance (only for wallet payments)
      if (paymentMethod === 'wallet' && onetimeTotal > 0 && newBalance !== walletBalance) {
        await this.Data.update(
          'customers',
          { wallet_balance: newBalance },
          [{ column: 'customer_id', operator: '=', value: customerId }],
          { transaction }
        );
      }

      // B. Process one-time order groups
      for (const [, group] of onetimeGroups) {
        const orderId = generateId('Ord', 15);
        if (!referenceId) {
          referenceType = 'order';
          referenceId = orderId;
        }

        const gstAmount = 0;
        const totalAmount = group.subtotal + gstAmount;

        // Create ONE order record for the group
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
            payment_status: (paymentType === 'postpaid' || isCod) ? 'pending' : 'paid',
            created_at: new Date(),
            updated_at: new Date(),
          },
          { transaction }
        );

        if (!orderInsert?.status) {
          throw new Error(`Failed to create order record for group: ${group.deliveryDate}/${group.deliverySlot}`);
        }

        // Create order_items for each product in this group
        for (const entry of group.items) {
          if (entry.productName) orderedProductNames.push(entry.productName);

          const itemInsert = await this.Data.insert(
            'order_items',
            {
              order_id: orderId,
              variant_id: entry.item.product_variant_id,
              unit_price: entry.price,
              quantity: entry.qty,
              is_free: false,
              created_at: new Date(),
            },
            { transaction }
          );

          if (!itemInsert?.status) {
            throw new Error(`Failed to create order item for variant: ${entry.item.product_variant_id}`);
          }
        }

        walletTransactionsToInsert.push({
          amount: totalAmount,
          reference_type: 'order',
          reference_id: orderId,
          remarks: paymentType === 'postpaid' ? 'Checkout postpaid order placement' : 'Checkout order placement',
        });
      }

      // C. Process subscription groups
      for (const [, group] of subscriptionGroups) {
        if (!subscriptionNumber) {
          subscriptionNumber = generateId('SUBNO', 15);

          await this.Data.update(
            'customers',
            {
              subscription_number: subscriptionNumber,
              updated_at: new Date(),
            },
            [
              {
                column: 'customer_id',
                operator: '=',
                value: customerId,
              },
            ],
            { transaction },
          );
        }

        const subscriptionId = generateId('SUB', 15);
        if (!referenceId) {
          referenceType = 'subscription';
          referenceId = subscriptionId;
        }

        // Create ONE subscription record for the group
        const subInsert = await this.Data.insert(
          'subscriptions',
          {
            subscription_id: subscriptionId,
            subscription_number: subscriptionNumber,
            address_id: addressId,
            branch_id: branchId,
            customer_id: customerId,
            schedule_type: 'weekly',
            payment_type: paymentType,
            billing_cycle: 'monthly',
            start_date: group.startDate,
            end_date: group.endDate,
            auto_renew: group.autoRenew,
            status: 'active',
            created_by: 'customer',
            updated_by: 'customer',
            created_at: new Date(),
            updated_at: new Date(),
          },
          { transaction },
        );

        if (!subInsert?.status) {
          throw new Error(`Failed to create subscription record for customer: ${customerId}`);
        }

        // Create subscription_items and weekly_schedule for each product in this group
        for (const entry of group.items) {
          subscribedProductNames.push(entry.productName);

          const firstPositive = entry.schedules.find(
            (s) => (s.m_quantity || 0) > 0 || (s.e_quantity || 0) > 0,
          );

          const subscriptionItemId = generateId('SUBITEM', 15);

          const itemInsert = await this.Data.insert(
            'subscription_items',
            {
              subscription_item_id: subscriptionItemId,
              subscription_id: subscriptionId,
              product_variant_id: entry.item.product_variant_id,
              default_m_quantity: firstPositive?.m_quantity || 0,
              default_e_quantity: firstPositive?.e_quantity || 0,
              unit_price: entry.price,
              status: 'active',
              start_date: group.startDate,
              created_at: new Date(),
              updated_at: new Date(),
            },
            { transaction },
          );

          if (!itemInsert?.status) {
            throw new Error(`Failed to create subscription item for variant: ${entry.item.product_variant_id}`);
          }

          // Insert weekly schedule rows for this item
          for (const schedule of entry.schedules) {
            if (
              (schedule.m_quantity || 0) > 0 ||
              (schedule.e_quantity || 0) > 0
            ) {
              await this.Data.insert(
                'subscription_weekly_schedule',
                {
                  subscription_item_id: subscriptionItemId,
                  subscription_id: subscriptionId,
                  day_of_week: schedule.day,
                  m_quantity: schedule.m_quantity || 0,
                  e_quantity: schedule.e_quantity || 0,
                  effective_from: new Date(),
                  created_at: new Date(),
                },
                { transaction },
              );
            }
          }
        }

        walletTransactionsToInsert.push({
          amount: group.subtotal,
          reference_type: 'subscription',
          reference_id: subscriptionId,
          remarks: paymentType === 'postpaid' ? 'Checkout postpaid subscription placement' : 'Checkout subscription placement',
        });
      }

      // 4. Save remaining cart items back to database
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
        { transaction }
      );

      // B. Insert wallet transaction ledger entries (only for wallet payments)
      if (paymentMethod === 'wallet') {
        await this.insertWalletTransactions(customerId, walletBalance, walletTransactionsToInsert, transaction);
      }

      // C. Insert customer_bills and customer_bill_items for prepaid payments
      if (paymentType === 'prepaid') {
        await this.insertPrepaidBillingRecords(customerId, onetimeGroups, subscriptionGroups, walletTransactionsToInsert, referenceId, transaction);
      }
    });



    try {
        if (orderedProductNames.length > 0) {
          const productsString = orderedProductNames.join(', ');


          const result = await this.pushNotificationService.sendNotificationToUsers(
            [customerId],
            {
              title: 'Order Placed Successfully! 🎉',
              body: `Your order for ${productsString} has been successfully placed.`,
            },
          );

        } else {
          this.developer.debug('Skipping push notification', {
            reason: 'No ordered products found',
            customerId,
          });
        }
      } catch (error) {
        this.developer.error('Order push notification failed', {
          customerId,
          orderedProductNames,
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
        });
      }

    // ── Save persistent in-app notifications to DB ──
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

      if (subscribedProductNames.length > 0) {
        const productsString = subscribedProductNames.join(', ');
        await this.notificationService.sendNotification({
          title: 'Subscription Activated! 📦',
          message: `Your subscription for ${productsString} is now active. Deliveries will begin as per your schedule.`,
          type: 'success',
          priority: 'medium',
          recipientIds: [customerId],
          senderId: customerId,
        });
      }
    } catch (notifError) {
      this.developer.error('Failed to save checkout notification to DB', {
        customerId,
        error: notifError instanceof Error ? notifError.message : notifError,
      });
    }

    const isPending = paymentMethod === 'cod' || paymentType === 'postpaid';
    const finalStatus = isPending ? 'pending' : 'success';

    // Format full IDs exactly as they should be displayed in the frontend
    // without the frontend doing any concatenation or format modifications.
    const displayId = referenceType === 'subscription' 
      ? `#SUB-${referenceId}`
      : `#F2H-${referenceId}`;

    return {
      success: true,
      message: 'Checkout processed successfully',
      status: finalStatus,
      id: displayId,
      address: addressLine,
    };
  }

  /**
   * Insert wallet transaction ledger entries for each checkout debit.
   */
  private async insertWalletTransactions(
    customerId: string,
    walletBalance: number,
    transactions: { amount: number; reference_type: string; reference_id: string; remarks: string }[],
    transaction: any,
  ): Promise<void> {
    let runningBalance = walletBalance;
    for (const tx of transactions) {
      if (tx.amount > 0) {
        runningBalance -= tx.amount;
        await this.Data.insert(
          'customer_wallet_transactions',
          {
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
        );
      }
    }
  }

  /**
   * Insert customer_bills and customer_bill_items for prepaid checkout payments.
   */
  private async insertPrepaidBillingRecords(
    customerId: string,
    onetimeGroups: Map<string, { deliveryDate: string; deliverySlot: string; items: { item: OnetimeCheckoutItemDto; price: number; qty: number; productName: string }[]; subtotal: number }>,
    subscriptionGroups: Map<string, { startDate: Date; endDate: Date; autoRenew: boolean; items: { item: SubscriptionCheckoutItemDto; price: number; productName: string; schedules: any[]; weeklyQty: number }[]; subtotal: number }>,
    walletTransactions: { amount: number; reference_type: string; reference_id: string; remarks: string }[],
    fallbackReferenceId: string | null,
    transaction: any,
  ): Promise<void> {
    // Bills for one-time order groups
    for (const [, group] of onetimeGroups) {
      const billId = generateId('BILL', 15);
      const today = new Date().toISOString().split('T')[0];
      const orderRefId = walletTransactions.find(
        (tx) => tx.reference_type === 'order',
      )?.reference_id || fallbackReferenceId;

      await this.Data.insert(
        'customer_bills',
        {
          bill_id: billId,
          customer_id: customerId,
          bill_type: 'order',
          reference_id: orderRefId,
          payment_type: 'prepaid',
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
      );

      // Insert bill items for each product in the order group
      for (const entry of group.items) {
        const itemTotal = entry.price * entry.qty;
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
          { transaction },
        );
      }
    }

    // Bills for subscription groups
    for (const [, group] of subscriptionGroups) {
      const billId = generateId('BILL', 15);
      const startDateStr = group.startDate.toISOString().split('T')[0];
      const endDateStr = group.endDate.toISOString().split('T')[0];
      const subRefId = walletTransactions.find(
        (tx) => tx.reference_type === 'subscription',
      )?.reference_id || fallbackReferenceId;

      await this.Data.insert(
        'customer_bills',
        {
          bill_id: billId,
          customer_id: customerId,
          bill_type: 'subscription',
          reference_id: subRefId,
          payment_type: 'prepaid',
          billing_from: startDateStr,
          billing_to: endDateStr,
          due_date: startDateStr,
          subtotal: group.subtotal,
          discount_amount: 0,
          tax_amount: 0,
          total_amount: group.subtotal,
          paid_amount: group.subtotal,
          due_amount: 0,
          status: 'paid',
          remarks: 'Prepaid subscription checkout',
          created_at: new Date(),
          updated_at: new Date(),
        },
        { transaction },
      );

      // Insert bill items for each product in the subscription group
      for (const entry of group.items) {
        const itemTotal = entry.price * entry.weeklyQty;
        await this.Data.insert(
          'customer_bill_items',
          {
            bill_id: billId,
            reference_type: 'subscription',
            reference_id: subRefId,
            product_variant_id: entry.item.product_variant_id,
            quantity: entry.weeklyQty,
            unit_price: entry.price,
            discount_amount: 0,
            tax_amount: 0,
            total_amount: itemTotal,
            created_at: new Date(),
          },
          { transaction },
        );
      }
    }
  }
}
