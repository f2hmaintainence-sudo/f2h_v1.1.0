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

  async checkout(body: CheckOutDto) {
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

    // Resolve Customer Details and Wallet balance
    const customerResult = await this.Data.query('customers', {
      select: [
        'wallet_balance',
        'full_name',
        'first_name',
        'last_name',
        'phone',
      ],
      where: [{ column: 'customer_id', operator: '=', value: customerId }],
      limit: 1,
    });
    const customer = customerResult?.data?.[0];
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
    const cartResult = await this.Data.query('carts', {
      select: ['cart_data'],
      where: [{ column: 'user_id', operator: '=', value: customerId }],
    });

    const cartRow = cartResult?.data?.[0];
    const currentCartItems = cartRow
      ? typeof cartRow.cart_data === 'string'
        ? JSON.parse(cartRow.cart_data)
        : cartRow.cart_data || []
      : [];

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

    // Run checkout transaction
    await this.Data.executeTransaction(async (transaction) => {
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
          { transaction },
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
          { transaction },
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
              unit_price: entry.price,
              quantity: entry.qty,
              is_free: false,
              created_at: new Date(),
            },
            { transaction },
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

      // C. Save remaining cart items
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
        { transaction },
      );

      // D. Insert wallet ledger entries
      if (paymentMethod === 'wallet') {
        await this.insertWalletTransactions(customerId, walletBalance, walletTransactionsToInsert, transaction);
      }

      // E. Insert customer_bills and customer_bill_items for prepaid orders
      if (paymentType === 'prepaid') {
        await this.insertPrepaidBillingRecords(customerId, onetimeGroups, walletTransactionsToInsert, referenceId, transaction, paymentMethod);
      }
    });

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

    const isPending = paymentMethod === 'cod' || paymentType === 'postpaid';
    const finalStatus = isPending ? 'pending' : 'success';
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

  private async insertPrepaidBillingRecords(
    customerId: string,
    onetimeGroups: Map<string, { deliveryDate: string; deliverySlot: string; items: { item: OnetimeCheckoutItemDto; price: number; qty: number; productName: string }[]; subtotal: number }>,
    walletTransactions: { amount: number; reference_type: string; reference_id: string; remarks: string }[],
    fallbackReferenceId: string | null,
    transaction: any,
    paymentMethod: string = 'wallet',
  ): Promise<void> {
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
      );

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
  }
}
