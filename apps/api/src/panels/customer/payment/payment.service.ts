// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : payment.service.ts
// Description : Customer payment orchestration — Razorpay order creation,
//               signature verification and idempotent fulfilment for wallet
//               top-ups, subscription bills and one-time order checkouts.
//
// ============================================================================

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';
import { RazorpayService } from 'src/shared/payments/razorpay.service';
import { WalletLedgerService } from 'src/shared/payments/wallet-ledger.service';

export const CHECKOUT_PENDING_REFERENCE = 'CHECKOUT_PENDING';
export const SUBSCRIPTION_PENDING_REFERENCE = 'SUBSCRIPTION_PENDING';

export type PaymentPurpose = 'wallet_topup' | 'bill' | 'order' | 'subscription';

const MIN_ONLINE_AMOUNT = 1;
const MAX_TOPUP_AMOUNT = 100000;
/** An 'order' payment not consumed by checkout within this window is swept
 *  into the customer's wallet so money is never left stranded. */
const ORDER_PAYMENT_RECONCILE_MINUTES = 20;
/** Placeholder references written while an order/subscription is being built.
 *  A row still carrying one of these is a checkout that never finished. */
const PENDING_REFERENCES = ['CHECKOUT_PENDING', 'SUBSCRIPTION_PENDING'];

export interface PaymentTransactionRow {
  id: string;
  transaction_id: string;
  customer_id: string;
  purpose: PaymentPurpose;
  reference_id: string | null;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  amount: string | number;
  currency: string;
  status: string;
  notes: Record<string, any>;
}

@Injectable()
export class CustomerPaymentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly razorpay: RazorpayService,
    private readonly wallet: WalletLedgerService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  //  Helpers
  // ══════════════════════════════════════════════════════════════════════════

  private async resolveCustomer(customerId: string) {
    const rows = await this.db.query(
      `SELECT c.customer_id,
              COALESCE(c.wallet_balance, 0)::numeric AS wallet_balance,
              COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
                       NULLIF(TRIM(u.user_name), ''),
                       'Customer') AS full_name,
              u.phone,
              u.email
         FROM customers c
         JOIN users u ON u.user_id = c.customer_id
        WHERE c.customer_id = $1
           OR (u.email IS NOT NULL AND u.email = $1 AND u.email != '')
        LIMIT 1`,
      [customerId],
    );

    const customer = rows?.[0];
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }
    return customer;
  }

  private buildInternalId(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `PT${ts}${rnd}`;
  }

  private toAmount(value: any): number {
    return Number(Number(value || 0).toFixed(2));
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Gateway configuration (client-safe)
  // ══════════════════════════════════════════════════════════════════════════

  async getGatewayConfig() {
    const config = await this.razorpay.getPublicConfig();
    return { status: true, data: config };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  1. Create a Razorpay order
  // ══════════════════════════════════════════════════════════════════════════

  async createOrder(
    customerId: string,
    body: {
      purpose?: PaymentPurpose;
      amount?: number;
      bill_id?: string;
      reference_id?: string;
      notes?: Record<string, any>;
    },
  ) {
    const purpose = (body?.purpose || 'wallet_topup') as PaymentPurpose;
    if (!['wallet_topup', 'bill', 'order', 'subscription'].includes(purpose)) {
      throw new BadRequestException('Unsupported payment purpose');
    }

    const customer = await this.resolveCustomer(customerId);
    const resolvedCustomerId = customer.customer_id;

    let amount = this.toAmount(body?.amount);
    let referenceId: string | null = body?.reference_id || null;

    // For bills the amount is always recomputed server-side — a client must
    // never be able to settle a ₹4,000 bill by asking to pay ₹1.
    //
    // A 'subscription' payment is not necessarily a bill payment. The first
    // charge for a new subscription is taken *before* the subscription — and so
    // its first bill — exists, leaving nothing to recompute against; it is priced
    // like an order. Demanding bill_id here made every new subscription checkout
    // fail with "bill_id is required for bill payments". A later subscription
    // bill still settles through the bill path by naming the bill explicitly.
    const billId =
      purpose === 'bill'
        ? body?.bill_id || body?.reference_id
        : body?.bill_id;

    if (purpose === 'bill' && !billId) {
      throw new BadRequestException('bill_id is required for bill payments');
    }

    if (billId && (purpose === 'bill' || purpose === 'subscription')) {
      const billRows = await this.db.query(
        `SELECT bill_id, total_amount, paid_amount,
                CASE
                  WHEN (due_amount IS NULL OR due_amount = 0)
                   AND (total_amount - paid_amount) > 0 THEN (total_amount - paid_amount)
                  WHEN (due_amount IS NULL OR due_amount = 0)
                   AND status = 'unpaid' THEN total_amount
                  ELSE COALESCE(due_amount, (total_amount - paid_amount))
                END AS due_amount,
                status
           FROM customer_bills
          WHERE bill_id = $1
            AND customer_id = $2
            AND status NOT IN ('paid', 'cancelled')
            AND deleted_at IS NULL
          LIMIT 1`,
        [billId, resolvedCustomerId],
      );

      const bill = billRows?.[0];
      if (!bill) {
        throw new BadRequestException('Bill not found or already paid');
      }

      amount = this.toAmount(bill.due_amount);
      referenceId = bill.bill_id;

      if (amount <= 0) {
        throw new BadRequestException('Bill has no pending due amount');
      }
    }

    if (purpose === 'wallet_topup') {
      if (amount < MIN_ONLINE_AMOUNT) {
        throw new BadRequestException(
          `Minimum top-up amount is ₹${MIN_ONLINE_AMOUNT}`,
        );
      }
      if (amount > MAX_TOPUP_AMOUNT) {
        throw new BadRequestException(
          `Maximum top-up amount is ₹${MAX_TOPUP_AMOUNT}`,
        );
      }
    }

    if (amount < MIN_ONLINE_AMOUNT) {
      throw new BadRequestException('Invalid payment amount');
    }

    const internalId = this.buildInternalId();

    const notes = {
      ...(body?.notes || {}),
      purpose,
      customer_id: resolvedCustomerId,
      internal_txn_id: internalId,
      ...(referenceId ? { reference_id: referenceId } : {}),
    };

    const order = await this.razorpay.createOrder({
      amount,
      receipt: internalId,
      notes,
    });

    await this.db.query(
      `INSERT INTO payment_transactions (
         transaction_id, customer_id, purpose, reference_id, provider,
         provider_order_id, amount, currency, status, notes
       ) VALUES ($1, $2, $3, $4, 'razorpay', $5, $6, $7, 'created', $8::jsonb)`,
      [
        internalId,
        resolvedCustomerId,
        purpose,
        referenceId,
        order.id,
        amount,
        order.currency || 'INR',
        JSON.stringify(notes),
      ],
    );

    const gateway = await this.razorpay.getPublicConfig();

    return {
      status: true,
      message: 'Payment order created',
      data: {
        transaction_id: internalId,
        purpose,
        reference_id: referenceId,
        razorpay_order_id: order.id,
        key_id: gateway.keyId,
        amount,
        amount_in_paise: order.amount,
        currency: order.currency || 'INR',
        name: gateway.companyName,
        description: this.describePurpose(purpose, referenceId),
        theme_color: gateway.themeColor,
        prefill: {
          name: customer.full_name || 'Customer',
          email: customer.email || '',
          contact: customer.phone || '',
        },
        notes,
      },
    };
  }

  private describePurpose(
    purpose: PaymentPurpose,
    referenceId: string | null,
  ): string {
    switch (purpose) {
      case 'wallet_topup':
        return 'F2H Wallet Top-up';
      case 'bill':
      case 'subscription':
        return `Subscription Bill ${referenceId || ''}`.trim();
      case 'order':
        return 'F2H Order Payment';
      default:
        return 'F2H Payment';
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  2. Verify a checkout callback and fulfil
  // ══════════════════════════════════════════════════════════════════════════

  async verifyPayment(
    customerId: string,
    body: {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    },
  ) {
    const orderId = body?.razorpay_order_id;
    const paymentId = body?.razorpay_payment_id;
    const signature = body?.razorpay_signature;

    if (!orderId || !paymentId || !signature) {
      throw new BadRequestException(
        'razorpay_order_id, razorpay_payment_id and razorpay_signature are required',
      );
    }

    const customer = await this.resolveCustomer(customerId);

    const txnRows = await this.db.query(
      `SELECT * FROM payment_transactions
        WHERE provider_order_id = $1 AND deleted_at IS NULL
        LIMIT 1`,
      [orderId],
    );
    const txn = txnRows?.[0];

    if (!txn) {
      throw new NotFoundException('Payment transaction not found');
    }
    if (txn.customer_id !== customer.customer_id) {
      throw new BadRequestException(
        'This payment does not belong to the current customer',
      );
    }

    const signatureValid = await this.razorpay.verifyCheckoutSignature({
      orderId,
      paymentId,
      signature,
    });

    if (!signatureValid) {
      await this.markFailed(
        txn.transaction_id,
        'Signature verification failed',
        paymentId,
      );
      this.developer.error('Razorpay signature verification failed', {
        orderId,
        paymentId,
        customerId: customer.customer_id,
      });
      throw new BadRequestException(
        'Payment verification failed. If money was debited it will be refunded automatically.',
      );
    }

    // The signature only proves the callback came from Razorpay; re-read the
    // payment server-side to confirm it was actually captured for this order.
    const payment = await this.razorpay.fetchPayment(paymentId);

    if (payment.order_id !== orderId) {
      await this.markFailed(
        txn.transaction_id,
        'Payment does not belong to this order',
        paymentId,
      );
      throw new BadRequestException('Payment verification failed');
    }

    if (!['captured', 'authorized'].includes(payment.status)) {
      await this.markFailed(
        txn.transaction_id,
        payment.error_description || `Payment status: ${payment.status}`,
        paymentId,
      );
      throw new BadRequestException(
        payment.error_description || 'Payment was not successful',
      );
    }

    const paidAmount = this.toAmount(payment.amount / 100);
    const expectedAmount = this.toAmount(txn.amount);
    if (paidAmount + 0.001 < expectedAmount) {
      await this.markFailed(
        txn.transaction_id,
        `Underpaid: expected ₹${expectedAmount}, received ₹${paidAmount}`,
        paymentId,
      );
      throw new BadRequestException('Paid amount does not match the order');
    }

    await this.markPaid(txn.transaction_id, payment.id, signature, payment.method);

    return this.fulfil(txn.transaction_id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  3. State transitions (idempotent)
  // ══════════════════════════════════════════════════════════════════════════

  private async markPaid(
    transactionId: string,
    paymentId: string,
    signature: string | null,
    method: string | null,
  ) {
    await this.db.query(
      `UPDATE payment_transactions
          SET status = CASE WHEN status IN ('fulfilled', 'refunded') THEN status ELSE 'paid' END,
              provider_payment_id = COALESCE(provider_payment_id, $2),
              provider_signature = COALESCE($3, provider_signature),
              method = COALESCE($4, method),
              paid_at = COALESCE(paid_at, NOW()),
              updated_at = NOW()
        WHERE transaction_id = $1`,
      [transactionId, paymentId, signature, method],
    );
  }

  private async markFailed(
    transactionId: string,
    reason: string,
    paymentId?: string,
  ) {
    try {
      await this.db.query(
        `UPDATE payment_transactions
            SET status = CASE WHEN status IN ('fulfilled', 'refunded') THEN status ELSE 'failed' END,
                failure_reason = $2,
                provider_payment_id = COALESCE(provider_payment_id, $3),
                updated_at = NOW()
          WHERE transaction_id = $1`,
        [transactionId, reason, paymentId || null],
      );
    } catch (error) {
      this.developer.error('Failed to mark payment transaction as failed', {
        transactionId,
        error,
      });
    }
  }

  /**
   * Runs the side effect for a paid transaction exactly once.
   *
   * The `status = 'paid'` guard in the UPDATE is the idempotency lock: whichever
   * of the checkout callback or the webhook gets there first flips the row to
   * `fulfilled` and receives the row back; the loser gets zero rows and simply
   * reports the already-completed result.
   */
  async fulfil(transactionId: string) {
    // 'order' payments are deliberately left in 'paid' — the checkout endpoint
    // consumes them when it writes the order rows. Bail out before claiming so
    // a concurrent checkout never sees the row flicker out of 'paid'.
    const preRows = await this.db.query(
      `SELECT * FROM payment_transactions WHERE transaction_id = $1 LIMIT 1`,
      [transactionId],
    );
    const pre = preRows?.[0];
    if (!pre) {
      throw new NotFoundException('Payment transaction not found');
    }
    // A 'subscription' payment that names no bill is the first charge for a new
    // subscription. Like an order it is consumed by the checkout call that
    // creates the subscription (see consumeOrderPayment, which accepts exactly
    // these two purposes), so it must not be settled here — fulfilBillPayment
    // would fail on the missing bill *after* the money had been captured.
    const awaitsCheckout =
      pre.purpose === 'order' ||
      (pre.purpose === 'subscription' && !pre.reference_id);

    if (awaitsCheckout) {
      return {
        status: pre.status === 'paid' || pre.status === 'fulfilled',
        message:
          pre.status === 'fulfilled'
            ? 'Payment already applied to an order'
            : 'Payment successful. Completing your order…',
        data: this.presentTransaction(pre),
      };
    }

    const claimed = await this.db.query(
      `UPDATE payment_transactions
          SET status = 'fulfilled', fulfilled_at = NOW(), updated_at = NOW()
        WHERE transaction_id = $1
          AND status = 'paid'
        RETURNING *`,
      [transactionId],
    );

    const txn = claimed?.[0];

    if (!txn) {
      const currentRows = await this.db.query(
        `SELECT * FROM payment_transactions WHERE transaction_id = $1 LIMIT 1`,
        [transactionId],
      );
      const current = currentRows?.[0];

      if (!current) {
        throw new NotFoundException('Payment transaction not found');
      }

      return {
        status: current.status === 'fulfilled',
        message:
          current.status === 'fulfilled'
            ? 'Payment already processed'
            : `Payment is in '${current.status}' state`,
        data: this.presentTransaction(current),
      };
    }

    try {
      if (txn.purpose === 'wallet_topup') {
        return await this.fulfilWalletTopup(txn);
      }
      if (txn.purpose === 'bill' || txn.purpose === 'subscription') {
        return await this.fulfilBillPayment(txn);
      }

      throw new BadRequestException(
        `No fulfilment handler for purpose '${txn.purpose}'`,
      );
    } catch (error) {
      // Roll the claim back so a retry (or the webhook) can fulfil it later.
      await this.db.query(
        `UPDATE payment_transactions
            SET status = 'paid', fulfilled_at = NULL,
                failure_reason = $2, updated_at = NOW()
          WHERE transaction_id = $1`,
        [transactionId, `Fulfilment failed: ${(error as Error)?.message}`],
      );
      this.developer.error('Payment fulfilment failed', {
        transactionId,
        purpose: txn.purpose,
        error,
      });
      throw error;
    }
  }

  private async fulfilWalletTopup(txn: any) {
    const amount = this.toAmount(txn.amount);

    const result = await this.wallet.credit({
      customerId: txn.customer_id,
      amount,
      referenceType: 'topup',
      referenceId: txn.transaction_id,
      remarks: `Wallet top-up via Razorpay (${txn.provider_payment_id || txn.provider_order_id})`,
      createdBy: txn.customer_id,
    });

    return {
      status: true,
      message: `₹${amount.toFixed(0)} added to your wallet successfully`,
      data: {
        ...this.presentTransaction({ ...txn, status: 'fulfilled' }),
        wallet_balance: result.balanceAfter,
        wallet_transaction_id: result.transactionId,
      },
    };
  }

  private async fulfilBillPayment(txn: any) {
    const amount = this.toAmount(txn.amount);
    const billId = txn.reference_id;

    await this.db.transaction(async (client) => {
      const billRows = await client.query(
        `SELECT bill_id, total_amount, paid_amount,
                COALESCE(due_amount, (total_amount - paid_amount)) AS due_amount
           FROM customer_bills
          WHERE bill_id = $1 AND customer_id = $2
          FOR UPDATE`,
        [billId, txn.customer_id],
      );

      const bill = billRows.rows?.[0];
      if (!bill) {
        throw new NotFoundException(`Bill ${billId} not found`);
      }

      const newPaid = Number(
        (Number(bill.paid_amount || 0) + amount).toFixed(2),
      );
      const newDue = Math.max(
        0,
        Number((Number(bill.total_amount || 0) - newPaid).toFixed(2)),
      );

      await client.query(
        `UPDATE customer_bills
            SET paid_amount = $1,
                due_amount = $2,
                status = CASE WHEN $2 <= 0 THEN 'paid' ELSE 'partial' END,
                payment_method = 'razorpay',
                remarks = $3,
                updated_at = NOW()
          WHERE bill_id = $4 AND customer_id = $5`,
        [
          newPaid,
          newDue,
          `Paid via Razorpay (${txn.provider_payment_id || txn.provider_order_id})`,
          billId,
          txn.customer_id,
        ],
      );

      await client.query(
        `INSERT INTO payments (
           payment_id, bill_id, customer_id, payment_method, amount,
           transaction_reference, payment_status, paid_at, remarks, created_at
         ) VALUES ($1, $2, $3, 'razorpay', $4, $5, 'success', NOW(), $6, NOW())
         ON CONFLICT (payment_id) DO NOTHING`,
        [
          txn.transaction_id.slice(0, 30),
          billId,
          txn.customer_id,
          amount,
          txn.provider_payment_id || txn.provider_order_id,
          'Online bill payment via Razorpay',
        ],
      );
    });

    try {
      await this.pushNotificationService.sendNotificationToUsers(
        [txn.customer_id],
        {
          title: 'Bill Payment Successful',
          body: `Your bill ${billId} of ₹${amount.toFixed(0)} has been paid successfully.`,
        },
      );
    } catch (error) {
      // Best-effort: the payment is already committed, and a failed push must not
      // fail the request. Logged so a persistent FCM outage is still visible.
      this.developer.warn('Bill payment push notification failed', { billId, error });
    }

    return {
      status: true,
      message: `Bill ${billId} paid successfully`,
      data: {
        ...this.presentTransaction({ ...txn, status: 'fulfilled' }),
        bill_id: billId,
      },
    };
  }

  private presentTransaction(txn: any) {
    return {
      transaction_id: txn.transaction_id,
      purpose: txn.purpose,
      reference_id: txn.reference_id,
      razorpay_order_id: txn.provider_order_id,
      razorpay_payment_id: txn.provider_payment_id,
      amount: this.toAmount(txn.amount),
      currency: txn.currency,
      status: txn.status,
      method: txn.method,
      paid_at: txn.paid_at,
      created_at: txn.created_at,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  4. Checkout consumption (called by the cart/checkout service)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Verifies (if not already verified) and locks an `order` payment against the
   * order being created. Returns the consumed transaction so the caller can
   * store the reference on the order rows.
   */
  async consumeOrderPayment(params: {
    customerId: string;
    razorpayOrderId: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    expectedAmount: number;
    orderReference: string;
  }) {
    const txnRows = await this.db.query(
      `SELECT * FROM payment_transactions
        WHERE provider_order_id = $1 AND deleted_at IS NULL
        LIMIT 1`,
      [params.razorpayOrderId],
    );
    const txn = txnRows?.[0];

    if (!txn) {
      throw new BadRequestException('Online payment record not found');
    }
    if (txn.customer_id !== params.customerId) {
      throw new BadRequestException(
        'This payment does not belong to the current customer',
      );
    }
    if (txn.purpose !== 'order' && txn.purpose !== 'subscription') {
      throw new BadRequestException(
        'This payment was not initiated for an order checkout or subscription',
      );
    }
    if (txn.status === 'fulfilled') {
      throw new BadRequestException(
        'This payment has already been used for another order/subscription',
      );
    }

    // Not verified yet (e.g. the client called checkout directly) — verify now.
    if (txn.status !== 'paid') {
      if (!params.razorpayPaymentId || !params.razorpaySignature) {
        throw new BadRequestException(
          'Payment has not been completed for this order',
        );
      }

      const valid = await this.razorpay.verifyCheckoutSignature({
        orderId: params.razorpayOrderId,
        paymentId: params.razorpayPaymentId,
        signature: params.razorpaySignature,
      });
      if (!valid) {
        await this.markFailed(
          txn.transaction_id,
          'Signature verification failed',
          params.razorpayPaymentId,
        );
        throw new BadRequestException('Payment verification failed');
      }

      const payment = await this.razorpay.fetchPayment(params.razorpayPaymentId);
      if (
        payment.order_id !== params.razorpayOrderId ||
        !['captured', 'authorized'].includes(payment.status)
      ) {
        await this.markFailed(
          txn.transaction_id,
          payment.error_description || `Payment status: ${payment.status}`,
          params.razorpayPaymentId,
        );
        throw new BadRequestException('Payment was not successful');
      }

      await this.markPaid(
        txn.transaction_id,
        payment.id,
        params.razorpaySignature,
        payment.method,
      );
    }

    const paidAmount = this.toAmount(txn.amount);
    // Half a paisa of tolerance absorbs rounding between the quote shown at
    // order-init time and the price re-computed at checkout.
    if (paidAmount + 0.005 < this.toAmount(params.expectedAmount)) {
      throw new BadRequestException(
        `Paid amount ₹${paidAmount.toFixed(2)} is less than the order total ₹${this.toAmount(params.expectedAmount).toFixed(2)}`,
      );
    }

    const consumed = await this.db.query(
      `UPDATE payment_transactions
          SET status = 'fulfilled',
              fulfilled_at = NOW(),
              reference_id = $2,
              updated_at = NOW()
        WHERE transaction_id = $1
          AND status = 'paid'
        RETURNING *`,
      [txn.transaction_id, params.orderReference],
    );

    if (!consumed?.length) {
      throw new BadRequestException(
        'This payment has already been used for another order',
      );
    }

    return this.presentTransaction(consumed[0]);
  }

  /** Re-points a consumed payment at the order id it actually paid for. */
  async attachOrderReference(transactionId: string, orderReference: string) {
    try {
      await this.db.query(
        `UPDATE payment_transactions
            SET reference_id = $2, updated_at = NOW()
          WHERE transaction_id = $1`,
        [transactionId, orderReference],
      );
    } catch (error) {
      this.developer.error('Failed to attach order reference to payment', {
        transactionId,
        orderReference,
        error,
      });
    }
  }

  /** Releases a consumed order payment back to 'paid' if order creation fails. */
  async releaseOrderPayment(transactionId: string, reason: string) {
    try {
      await this.db.query(
        `UPDATE payment_transactions
            SET status = 'paid', fulfilled_at = NULL, reference_id = NULL,
                failure_reason = $2, updated_at = NOW()
          WHERE transaction_id = $1 AND status = 'fulfilled'`,
        [transactionId, reason],
      );
    } catch (error) {
      this.developer.error('Failed to release order payment', {
        transactionId,
        error,
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  5. Webhook
  // ══════════════════════════════════════════════════════════════════════════

  async handleWebhook(rawBody: string, signature: string) {
    const valid = await this.razorpay.verifyWebhookSignature(rawBody, signature);
    if (!valid) {
      this.developer.error('Razorpay webhook signature rejected', {
        signaturePresent: !!signature,
      });
      throw new BadRequestException('Invalid webhook signature');
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    const eventType = event?.event || 'unknown';
    const paymentEntity = event?.payload?.payment?.entity;
    const orderEntity = event?.payload?.order?.entity;
    const eventId =
      paymentEntity?.id ||
      orderEntity?.id ||
      `${eventType}_${event?.created_at || Date.now()}`;

    // Razorpay retries webhooks; the unique (provider, event_id) index makes a
    // repeat delivery a no-op instead of a second credit.
    const inserted = await this.db.query(
      `INSERT INTO payment_webhook_events (provider, event_id, event_type, payload)
       VALUES ('razorpay', $1, $2, $3::jsonb)
       ON CONFLICT (provider, event_id) DO NOTHING
       RETURNING id`,
      [`${eventType}:${eventId}`, eventType, rawBody],
    );

    if (!inserted?.length) {
      return { status: true, message: 'Duplicate webhook ignored' };
    }

    let note = 'ignored';

    try {
      if (
        (eventType === 'payment.captured' || eventType === 'payment.authorized') &&
        paymentEntity?.order_id
      ) {
        note = await this.processWebhookPaymentSuccess(paymentEntity);
      } else if (eventType === 'payment.failed' && paymentEntity?.order_id) {
        const txn = await this.findTransactionByOrderId(paymentEntity.order_id);
        if (txn) {
          await this.markFailed(
            txn.transaction_id,
            paymentEntity.error_description || 'Payment failed at gateway',
            paymentEntity.id,
          );
          note = `marked failed: ${txn.transaction_id}`;
        }
      } else if (eventType === 'order.paid' && orderEntity?.id) {
        const txn = await this.findTransactionByOrderId(orderEntity.id);
        note = txn ? `order.paid noted for ${txn.transaction_id}` : 'no txn';
      } else if (eventType === 'refund.processed' && paymentEntity?.id) {
        await this.db.query(
          `UPDATE payment_transactions
              SET status = 'refunded', updated_at = NOW()
            WHERE provider_payment_id = $1`,
          [paymentEntity.id],
        );
        note = 'refund recorded';
      }
    } catch (error: any) {
      note = `error: ${error?.message}`;
      this.developer.error('Razorpay webhook processing failed', {
        eventType,
        error,
      });
    }

    await this.db.query(
      `UPDATE payment_webhook_events
          SET processed = true, process_note = $2
        WHERE provider = 'razorpay' AND event_id = $1`,
      [`${eventType}:${eventId}`, note],
    );

    return { status: true, message: 'Webhook processed' };
  }

  private async processWebhookPaymentSuccess(payment: any): Promise<string> {
    const txn = await this.findTransactionByOrderId(payment.order_id);
    if (!txn) {
      return 'no matching transaction';
    }

    const paidAmount = this.toAmount(Number(payment.amount || 0) / 100);
    if (paidAmount + 0.001 < this.toAmount(txn.amount)) {
      await this.markFailed(
        txn.transaction_id,
        `Webhook underpayment: ₹${paidAmount}`,
        payment.id,
      );
      return 'underpaid';
    }

    await this.markPaid(txn.transaction_id, payment.id, null, payment.method);

    // Order payments are fulfilled by checkout; everything else settles here so
    // a customer who closed the app mid-payment still gets their money.
    if (txn.purpose === 'order') {
      return `order payment marked paid: ${txn.transaction_id}`;
    }

    await this.fulfil(txn.transaction_id);
    return `fulfilled: ${txn.transaction_id}`;
  }

  private async findTransactionByOrderId(orderId: string) {
    const rows = await this.db.query(
      `SELECT * FROM payment_transactions
        WHERE provider_order_id = $1 AND deleted_at IS NULL
        LIMIT 1`,
      [orderId],
    );
    return rows?.[0] || null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  6. Reconciliation — money paid but never consumed
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Sweeps `order` payments that were captured but never turned into an order
   * (app crash, network drop after payment) into the customer's wallet.
   */
  async reconcileStrandedOrderPayments(): Promise<{ swept: number }> {
    const stranded = await this.db.query(
      `SELECT * FROM payment_transactions
        WHERE purpose = 'order'
          AND deleted_at IS NULL
          AND paid_at < NOW() - ($1 || ' minutes')::interval
          AND (
            -- captured, but checkout never claimed it
            (status = 'paid' AND reference_id IS NULL)
            -- claimed by a checkout that died before writing the order
            OR (status = 'fulfilled' AND reference_id = ANY($2))
          )
        LIMIT 50`,
      [String(ORDER_PAYMENT_RECONCILE_MINUTES), PENDING_REFERENCES],
    );

    let swept = 0;

    for (const txn of stranded || []) {
      try {
        const claimed = await this.db.query(
          `UPDATE payment_transactions
              SET status = 'fulfilled', fulfilled_at = NOW(),
                  purpose = 'wallet_topup',
                  reference_id = NULL,
                  notes = notes || '{"swept_from":"order"}'::jsonb,
                  updated_at = NOW()
            WHERE transaction_id = $1
              AND purpose = 'order'
              AND (
                (status = 'paid' AND reference_id IS NULL)
                OR (status = 'fulfilled' AND reference_id = ANY($2))
              )
            RETURNING *`,
          [txn.transaction_id, PENDING_REFERENCES],
        );
        if (!claimed?.length) continue;

        await this.wallet.credit({
          customerId: txn.customer_id,
          amount: this.toAmount(txn.amount),
          referenceType: 'topup',
          referenceId: txn.transaction_id,
          remarks:
            'Online payment received but order was not completed — credited to wallet',
          createdBy: 'system',
        });
        swept += 1;
      } catch (error) {
        this.developer.error('Stranded payment sweep failed', {
          transactionId: txn.transaction_id,
          error,
        });
      }
    }

    return { swept };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  7. History
  // ══════════════════════════════════════════════════════════════════════════

  async getPaymentHistory(customerId: string, limit = 50) {
    const customer = await this.resolveCustomer(customerId);

    const rows = await this.db.query(
      `SELECT transaction_id, purpose, reference_id, provider_order_id,
              provider_payment_id, amount, currency, status, method,
              paid_at, created_at
         FROM payment_transactions
        WHERE customer_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT $2`,
      [customer.customer_id, Math.min(Number(limit) || 50, 200)],
    );

    return {
      status: true,
      data: (rows || []).map((r: any) => ({
        ...r,
        amount: this.toAmount(r.amount),
      })),
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  8. Bills — listing & wallet settlement
  // ══════════════════════════════════════════════════════════════════════════

  async getUnpaidBills(customerId: string) {
    try {
      const customer = await this.resolveCustomer(customerId);
      const resolvedCustomerId = customer.customer_id;
      const walletBalance = Number(customer.wallet_balance || 0);

      const bills = await this.db.query(
        `SELECT bill_id, customer_id, bill_type, reference_id, billing_from, billing_to, due_date,
                subtotal, discount_amount, tax_amount, total_amount, paid_amount,
                CASE
                  WHEN (due_amount IS NULL OR due_amount = 0)
                   AND (total_amount - paid_amount) > 0 THEN (total_amount - paid_amount)
                  WHEN (due_amount IS NULL OR due_amount = 0)
                   AND status = 'unpaid' THEN total_amount
                  ELSE COALESCE(due_amount, (total_amount - paid_amount))
                END AS due_amount,
                status, remarks, created_at
           FROM customer_bills
          WHERE customer_id = $1
            AND status NOT IN ('paid', 'cancelled')
            AND deleted_at IS NULL
          ORDER BY due_date ASC, created_at DESC`,
        [resolvedCustomerId],
      );

      const totalUnpaidAmount = (bills || []).reduce(
        (sum: number, b: any) => sum + Number(b.due_amount || 0),
        0,
      );

      const gateway = await this.razorpay.getPublicConfig();

      const enrichedBills = await Promise.all(
        (bills || []).map(async (b: any) => {
          // Determine Month Name
          const fromDate = b.billing_from
            ? new Date(b.billing_from)
            : b.created_at
              ? new Date(b.created_at)
              : new Date();
          const monthName = new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            month: 'long',
            year: 'numeric',
          }).format(fromDate);

          const periodLabel =
            b.billing_from && b.billing_to
              ? `${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' }).format(new Date(b.billing_from))} – ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(b.billing_to))}`
              : monthName;

          // Fetch associated subscriptions from bill items or customer active subscriptions
          let subRows = await this.db.query(
            `SELECT DISTINCT o.subscription_id, COALESCE(p.name, pv.name, 'Subscription') AS product_name
             FROM customer_bill_items cbi
             JOIN orders o ON o.order_id = cbi.reference_id
             LEFT JOIN subscriptions s ON s.subscription_id = o.subscription_id
             LEFT JOIN subscription_items si ON si.subscription_id = s.subscription_id
             LEFT JOIN product_variants pv ON pv.variant_id = si.product_variant_id
             LEFT JOIN products p ON p.product_id = pv.product_id
             WHERE cbi.bill_id = $1 AND o.subscription_id IS NOT NULL`,
            [b.bill_id],
          );

          if (!subRows || subRows.length === 0) {
            subRows = await this.db.query(
              `SELECT s.subscription_id, COALESCE(p.name, pv.name, 'Subscription') AS product_name
               FROM subscriptions s
               LEFT JOIN subscription_items si ON si.subscription_id = s.subscription_id
               LEFT JOIN product_variants pv ON pv.variant_id = si.product_variant_id
               LEFT JOIN products p ON p.product_id = pv.product_id
               WHERE s.customer_id = $1
                 AND (s.payment_type = 'postpaid' OR s.status = 'active')
               LIMIT 3`,
              [resolvedCustomerId],
            );
          }

          const subscriptionIds = Array.from(
            new Set((subRows || []).map((r: any) => r.subscription_id).filter(Boolean)),
          );
          const productNames = Array.from(
            new Set((subRows || []).map((r: any) => r.product_name).filter(Boolean)),
          );
          const primarySubId =
            subscriptionIds.length > 0
              ? subscriptionIds[0]
              : b.reference_id && b.reference_id !== 'CONSOLIDATED'
                ? b.reference_id
                : null;
          const primaryProductName =
            productNames.length > 0 ? productNames.join(', ') : 'Daily Subscription';

          return {
            bill_id: b.bill_id,
            customer_id: b.customer_id,
            bill_type: b.bill_type,
            reference_id: b.reference_id,
            billing_from: b.billing_from,
            billing_to: b.billing_to,
            due_date: b.due_date,
            total_amount: Number(b.total_amount),
            paid_amount: Number(b.paid_amount),
            due_amount: Number(b.due_amount),
            status: b.status,
            remarks: b.remarks,
            created_at: b.created_at,
            billing_month: monthName,
            billing_period_label: periodLabel,
            subscription_id: primarySubId,
            subscription_ids: subscriptionIds,
            product_name: primaryProductName,
            product_names: productNames,
            has_sufficient_wallet: walletBalance >= Number(b.due_amount),
            wallet_shortfall: Math.max(0, Number(b.due_amount) - walletBalance),
          };
        }),
      );

      return {
        status: true,
        has_unpaid_bills: (bills || []).length > 0,
        unpaid_count: (bills || []).length,
        total_unpaid_amount: totalUnpaidAmount,
        wallet_balance: walletBalance,
        has_sufficient_wallet:
          walletBalance >= totalUnpaidAmount && totalUnpaidAmount > 0,
        online_payment_enabled: gateway.enabled,
        bills: enrichedBills,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.developer.error('getUnpaidBills error', { error, customerId });
      throw new InternalServerErrorException('Failed to fetch unpaid bills');
    }
  }

  async payBillFromWallet(customerId: string, billId: string) {
    if (!billId) {
      throw new BadRequestException('bill_id is required');
    }

    const customer = await this.resolveCustomer(customerId);
    const resolvedCustomerId = customer.customer_id;
    const currentWalletBalance = Number(customer.wallet_balance || 0);

    const billRows = await this.db.query(
      `SELECT bill_id, total_amount, paid_amount,
              COALESCE(due_amount, (total_amount - paid_amount)) AS due_amount, status
         FROM customer_bills
        WHERE bill_id = $1 AND customer_id = $2
          AND status NOT IN ('paid', 'cancelled')
          AND deleted_at IS NULL
        LIMIT 1`,
      [billId, resolvedCustomerId],
    );

    const bill = billRows?.[0];
    if (!bill) {
      throw new BadRequestException('Bill not found or already paid');
    }

    const amountToPay = this.toAmount(bill.due_amount);
    if (amountToPay <= 0) {
      throw new BadRequestException('Bill has no pending due amount');
    }

    if (currentWalletBalance < amountToPay) {
      return {
        status: false,
        code: 'INSUFFICIENT_WALLET',
        message: 'Insufficient wallet balance to clear this bill',
        bill_id: billId,
        required_amount: amountToPay,
        wallet_balance: currentWalletBalance,
        shortfall: amountToPay - currentWalletBalance,
      };
    }

    const movement = await this.wallet.debit({
      customerId: resolvedCustomerId,
      amount: amountToPay,
      referenceType: 'subscription_bill',
      referenceId: billId,
      remarks: `Payment for subscription bill ${billId}`,
      createdBy: resolvedCustomerId,
    });

    await this.db.query(
      `UPDATE customer_bills
          SET status = 'paid', paid_amount = total_amount, due_amount = 0,
              payment_method = 'wallet', updated_at = NOW()
        WHERE bill_id = $1 AND customer_id = $2`,
      [billId, resolvedCustomerId],
    );

    try {
      await this.pushNotificationService.sendNotificationToUsers(
        [resolvedCustomerId],
        {
          title: 'Bill Payment Successful',
          body: `Your subscription bill ${billId} of ₹${amountToPay} has been paid successfully from your wallet.`,
        },
      );
    } catch (error) {
      // Best-effort, as above: the wallet has already been debited.
      this.developer.warn('Subscription bill push notification failed', { billId, error });
    }

    return {
      status: true,
      message: `Bill ${billId} paid successfully from wallet!`,
      bill_id: billId,
      amount_paid: amountToPay,
      remaining_wallet_balance: movement.balanceAfter,
    };
  }
}
