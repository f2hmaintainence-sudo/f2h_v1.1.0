import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionStatusRepository } from './subscription-status.repository';
import { NotificationService } from '../../../../../notifications/notification.service';
import { PushNotificationService } from '../../../../../shared/pushNotifications/pushNotification.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { DatabaseService } from '../../../../../shared/database/Database.service';
import { generateId } from '../../../../../helpers/RandomHelper';

export interface StatusProcessingResult {
  processedCount: number;
  renewedCount: number;
  completedCount: number;
  expiredCount: number;
  remindersSent: number;
  failedCount: number;
  skippedCount: number;
  durationMs: number;
  details: any[];
}

@Injectable()
export class SubscriptionStatusService {
  private readonly logger = new Logger(SubscriptionStatusService.name);

  /** Days before month-end on which the cron should act */
  private readonly TARGET_DAYS = [7, 5, 3, 1, 0];
  /** Days on which reminder notifications are sent */
  private readonly REMINDER_DAYS = [7, 3, 1, 0];

  constructor(
    private readonly repository: SubscriptionStatusRepository,
    private readonly db: DatabaseService,
    private readonly notificationService: NotificationService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly developer: DeveloperService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  //  MAIN ENTRY POINT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Process all active subscriptions approaching their end_date.
   * Called by the cron job daily — internally checks shouldRunToday().
   */
  async processSubscriptionStatuses(): Promise<StatusProcessingResult> {
    const startedAt = Date.now();
    const result: StatusProcessingResult = {
      processedCount: 0,
      renewedCount: 0,
      completedCount: 0,
      expiredCount: 0,
      remindersSent: 0,
      failedCount: 0,
      skippedCount: 0,
      durationMs: 0,
      details: [],
    };

    if (!this.shouldRunToday()) {
      this.logger.log('[SubscriptionStatus] Not a target day — skipping.');
      result.durationMs = Date.now() - startedAt;
      return result;
    }

    try {
      // Fetch subscriptions where days_remaining matches any of our target days
      const subscriptions = await this.repository.findSubscriptionsNearingEnd(this.TARGET_DAYS);
      this.logger.log(`[SubscriptionStatus] Found ${subscriptions.length} subscriptions to process.`);

      for (const sub of subscriptions) {
        try {
          const outcome = await this.processSubscription(sub);
          result.processedCount++;
          result.details.push({ subscriptionId: sub.subscription_id, ...outcome });

          if (outcome.action === 'renewed') result.renewedCount++;
          else if (outcome.action === 'completed') result.completedCount++;
          else if (outcome.action === 'expired') result.expiredCount++;
          else if (outcome.action === 'reminder') result.remindersSent++;
          else if (outcome.action === 'skipped') result.skippedCount++;
        } catch (err: any) {
          result.failedCount++;
          result.details.push({
            subscriptionId: sub.subscription_id,
            action: 'error',
            error: err.message,
          });
          this.logger.error(
            `[SubscriptionStatus] Failed processing ${sub.subscription_id}: ${err.message}`,
            err.stack,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`[SubscriptionStatus] Fatal error: ${err.message}`, err.stack);
    }

    result.durationMs = Date.now() - startedAt;
    this.logger.log(
      `[SubscriptionStatus] Done in ${result.durationMs}ms — ` +
      `processed=${result.processedCount} renewed=${result.renewedCount} ` +
      `completed=${result.completedCount} expired=${result.expiredCount} ` +
      `reminders=${result.remindersSent} failed=${result.failedCount}`,
    );

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SINGLE SUBSCRIPTION PROCESSOR
  // ═══════════════════════════════════════════════════════════════════════

  private async processSubscription(sub: any): Promise<{ action: string; message: string }> {
    const daysRemaining = Number(sub.days_remaining);
    const paymentType = String(sub.payment_type).toLowerCase();
    const autoRenew = sub.auto_renew === true || sub.auto_renew === 'true';

    this.logger.debug(
      `Processing ${sub.subscription_id}: payment=${paymentType} autoRenew=${autoRenew} daysRemaining=${daysRemaining}`,
    );

    if (paymentType === 'prepaid') {
      if (!autoRenew) {
        return this.handlePrepaidNoAutoRenew(sub, daysRemaining);
      } else {
        return this.handlePrepaidAutoRenew(sub, daysRemaining);
      }
    } else {
      // postpaid
      if (!autoRenew) {
        return this.handlePostpaidNoAutoRenew(sub, daysRemaining);
      } else {
        return this.handlePostpaidAutoRenew(sub, daysRemaining);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PREPAID FLOWS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Prepaid + auto_renew=false
   * - Send reminders at 7, 3, 1 days before
   * - On day 0: mark completed
   */
  private async handlePrepaidNoAutoRenew(
    sub: any,
    daysRemaining: number,
  ): Promise<{ action: string; message: string }> {
    if (daysRemaining === 0) {
      await this.completeSubscription(sub, 'Subscription period ended (no auto-renew).');
      return { action: 'completed', message: 'Marked as completed' };
    }

    if (this.REMINDER_DAYS.includes(daysRemaining)) {
      await this.sendNotification(
        sub.customer_id,
        '📋 Subscription Ending Soon',
        `Your subscription #${sub.subscription_number} ends in ${daysRemaining} day(s). Renew subscription to continue deliveries.`,
        'warning',
      );
      await this.sendPushNotification(
        sub.customer_id,
        '📋 Subscription Ending Soon',
        `Subscription ending in ${daysRemaining} day(s). Renew subscription.`,
      );
      return { action: 'reminder', message: `Reminder sent (${daysRemaining} days remaining)` };
    }

    return { action: 'skipped', message: `Not a reminder day (${daysRemaining} days remaining)` };
  }

  /**
   * Prepaid + auto_renew=true
   * - Attempt wallet deduction
   * - If wallet insufficient and days > 0: send reminder
   * - If wallet insufficient and day 0: try postpaid fallback
   */
  private async handlePrepaidAutoRenew(
    sub: any,
    daysRemaining: number,
  ): Promise<{ action: string; message: string }> {
    const renewalAmount = await this.repository.calculateRenewalAmount(sub.subscription_id);
    const walletBalance = Number(sub.wallet_balance || 0);

    if (walletBalance >= renewalAmount && renewalAmount > 0) {
      // Sufficient balance — renew now
      return this.executePrepaidRenewal(sub, renewalAmount, walletBalance);
    }

    // Insufficient balance
    if (daysRemaining > 0) {
      // Record failed attempt
      await this.repository.insertRenewalAttempt({
        subscription_id: sub.subscription_id,
        customer_id: sub.customer_id,
        attempt_type: 'auto_renew',
        payment_type: 'prepaid',
        renewal_amount: renewalAmount,
        wallet_balance_at_attempt: walletBalance,
        status: 'failed_insufficient_balance',
        failure_reason: `Wallet ₹${walletBalance.toFixed(2)} < Renewal ₹${renewalAmount.toFixed(2)}`,
        old_end_date: this.formatDate(sub.end_date),
      });

      // Send reminder notification at 7, 3, 1 days or on active reminder window
      if (this.REMINDER_DAYS.includes(daysRemaining)) {
        await this.sendNotification(
          sub.customer_id,
          'Insufficient wallet balance',
          'Insufficient wallet balance. Please top up wallet before expiry.',
          'warning',
        );
        await this.sendPushNotification(
          sub.customer_id,
          'Insufficient wallet balance',
          'Please top up wallet before expiry.',
        );
      }

      await this.logAction(sub.subscription_id, 'renewal_reminder_insufficient_balance', {
        daysRemaining,
        walletBalance,
        renewalAmount,
      });

      return { action: 'reminder', message: `Insufficient wallet — reminder sent (${daysRemaining} days)` };
    }

    // Day 0 — Expiry day
    return this.handlePrepaidPostpaidFallback(sub, renewalAmount, walletBalance);
  }

  /**
   * Execute the actual prepaid wallet deduction and renewal.
   * Runs inside a database transaction.
   */
  private async executePrepaidRenewal(
    sub: any,
    renewalAmount: number,
    walletBalance: number,
  ): Promise<{ action: string; message: string }> {
    const oldEndDate = this.formatDate(sub.end_date);
    const newEndDate = this.calculateNewEndDate(sub.end_date, 'prepaid');
    const billId = generateId('BILL', 15);

    await this.db.transaction(async (client) => {
      // 1. Deduct wallet
      const newBalance = await this.repository.deductWalletBalance(
        sub.customer_id,
        renewalAmount,
        client,
      );

      // 2. Insert wallet transaction
      await this.repository.insertWalletTransaction(
        {
          customer_id: sub.customer_id,
          transaction_type: 'debit',
          amount: renewalAmount,
          balance_after: newBalance,
          reference_type: 'subscription_renewal',
          reference_id: sub.subscription_id,
          remarks: `Subscription renewal #${sub.subscription_number}`,
          created_by: 'system',
        },
        client,
      );

      // 3. Create paid bill
      await this.repository.insertCustomerBill(
        {
          bill_id: billId,
          customer_id: sub.customer_id,
          bill_type: 'subscription',
          reference_id: sub.subscription_id,
          payment_type: 'prepaid',
          billing_from: oldEndDate,
          billing_to: newEndDate,
          due_date: oldEndDate,
          subtotal: renewalAmount,
          total_amount: renewalAmount,
          paid_amount: renewalAmount,
          due_amount: 0,
          status: 'paid',
          remarks: `Auto-renewal for subscription #${sub.subscription_number}`,
        },
        client,
      );

      // 4. Extend subscription end_date (keep status active)
      await this.repository.updateSubscriptionStatus(
        sub.subscription_id,
        'active',
        newEndDate,
        client,
      );

      // 5. Log renewal attempt
      await this.repository.insertRenewalAttempt(
        {
          subscription_id: sub.subscription_id,
          customer_id: sub.customer_id,
          attempt_type: 'auto_renew',
          payment_type: 'prepaid',
          renewal_amount: renewalAmount,
          wallet_balance_at_attempt: walletBalance,
          bill_id: billId,
          status: 'success',
          old_end_date: oldEndDate,
          new_end_date: newEndDate,
        },
        client,
      );

      // 6. Log action
      await this.repository.insertSubscriptionLog(
        {
          subscription_id: sub.subscription_id,
          action: 'renewed',
          old_data: { end_date: oldEndDate, wallet_balance: walletBalance },
          new_data: { end_date: newEndDate, wallet_deducted: renewalAmount, bill_id: billId },
          created_by: 'system',
        },
        client,
      );
    });

    // Send notifications outside transaction
    await this.sendNotification(
      sub.customer_id,
      'Subscription renewed successfully',
      `Wallet amount deducted: ₹${renewalAmount.toFixed(0)}. Your subscription #${sub.subscription_number} is active until ${newEndDate}.`,
      'success',
    );
    await this.sendPushNotification(
      sub.customer_id,
      'Subscription renewed successfully',
      `Wallet amount deducted: ₹${renewalAmount.toFixed(0)}. Active until ${newEndDate}.`,
    );

    return { action: 'renewed', message: `Prepaid renewal successful — ₹${renewalAmount} deducted` };
  }

  /**
   * Prepaid auto_renew=true, day 0, wallet insufficient.
   * Try postpaid fallback if customer is postpaid-enabled.
   */
  private async handlePrepaidPostpaidFallback(
    sub: any,
    renewalAmount: number,
    walletBalance: number,
  ): Promise<{ action: string; message: string }> {
    const isPostpaidEnabled =
      sub.is_postpaid_enabled === true || sub.is_postpaid_enabled === 'true';

    if (isPostpaidEnabled) {
      const creditLimit = Number(sub.postpaid_credit_limit || 0);
      const outstandingAmount = await this.repository.getTotalOutstandingAmount(sub.customer_id);

      if (outstandingAmount + renewalAmount <= creditLimit) {
        // Convert to postpaid and continue
        const oldEndDate = this.formatDate(sub.end_date);
        const newEndDate = this.calculateNewEndDate(sub.end_date, 'postpaid');
        const billId = generateId('BILL', 15);

        await this.db.transaction(async (client) => {
          // Convert payment type
          await this.repository.updateSubscriptionPaymentType(
            sub.subscription_id,
            'postpaid',
            client,
          );

          // Extend end_date
          await this.repository.updateSubscriptionStatus(
            sub.subscription_id,
            'active',
            newEndDate,
            client,
          );

          // Create unpaid postpaid bill
          await this.repository.insertCustomerBill(
            {
              bill_id: billId,
              customer_id: sub.customer_id,
              bill_type: 'subscription',
              reference_id: sub.subscription_id,
              payment_type: 'postpaid',
              billing_from: oldEndDate,
              billing_to: newEndDate,
              due_date: this.addDays(oldEndDate, 5),
              subtotal: renewalAmount,
              total_amount: renewalAmount,
              paid_amount: 0,
              due_amount: renewalAmount,
              status: 'unpaid',
              remarks: `Converted from prepaid — auto-renewal with postpaid fallback`,
            },
            client,
          );

          await this.repository.insertRenewalAttempt(
            {
              subscription_id: sub.subscription_id,
              customer_id: sub.customer_id,
              attempt_type: 'postpaid_convert',
              payment_type: 'postpaid',
              renewal_amount: renewalAmount,
              wallet_balance_at_attempt: walletBalance,
              bill_id: billId,
              status: 'success',
              old_end_date: oldEndDate,
              new_end_date: newEndDate,
            },
            client,
          );

          await this.repository.insertSubscriptionLog(
            {
              subscription_id: sub.subscription_id,
              action: 'converted_to_postpaid',
              old_data: { payment_type: 'prepaid', end_date: oldEndDate },
              new_data: { payment_type: 'postpaid', end_date: newEndDate, bill_id: billId },
              created_by: 'system',
            },
            client,
          );
        });

        await this.sendNotification(
          sub.customer_id,
          'Subscription converted to postpaid',
          'Subscription converted to postpaid and continued successfully.',
          'info',
        );
        await this.sendPushNotification(
          sub.customer_id,
          'Subscription converted to postpaid',
          'Subscription converted to postpaid and continued successfully.',
        );

        return { action: 'renewed', message: 'Converted to postpaid and renewed' };
      }
    }

    // Cannot renew — mark completed
    await this.repository.insertRenewalAttempt({
      subscription_id: sub.subscription_id,
      customer_id: sub.customer_id,
      attempt_type: 'auto_renew',
      payment_type: 'prepaid',
      renewal_amount: renewalAmount,
      wallet_balance_at_attempt: walletBalance,
      status: isPostpaidEnabled ? 'failed_credit_limit' : 'failed_insufficient_balance',
      failure_reason: isPostpaidEnabled
        ? 'Postpaid credit limit exceeded'
        : 'Wallet insufficient and postpaid not enabled',
      old_end_date: this.formatDate(sub.end_date),
    });

    await this.completeSubscription(
      sub,
      'Insufficient wallet balance for auto-renewal.',
      'Subscription completed due to insufficient wallet balance. Renew now.',
    );

    return { action: 'completed', message: 'Wallet insufficient — marked completed' };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  POSTPAID FLOWS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Postpaid + auto_renew=false
   * - Send reminders
   * - On day 0: mark completed
   */
  private async handlePostpaidNoAutoRenew(
    sub: any,
    daysRemaining: number,
  ): Promise<{ action: string; message: string }> {
    if (daysRemaining === 0) {
      await this.completeSubscription(
        sub,
        'Postpaid subscription period ended (no auto-renew).',
        'Subscription completed. Renew subscription.',
      );
      return { action: 'completed', message: 'Marked as completed' };
    }

    if (this.REMINDER_DAYS.includes(daysRemaining)) {
      await this.sendNotification(
        sub.customer_id,
        'Subscription ending soon',
        `Subscription ending in ${daysRemaining} day(s). Renew subscription.`,
        'warning',
      );
      await this.sendPushNotification(
        sub.customer_id,
        'Subscription ending soon',
        `Subscription ending in ${daysRemaining} day(s). Renew subscription.`,
      );
      return { action: 'reminder', message: `Reminder sent (${daysRemaining} days remaining)` };
    }

    return { action: 'skipped', message: `Not a reminder day (${daysRemaining} days remaining)` };
  }

  /**
   * Postpaid + auto_renew=true
   * - Check for 2 consecutive unpaid billing cycles
   * - If clear: renew with unpaid bill
   * - If 2+ unpaid: expire
   */
  private async handlePostpaidAutoRenew(
    sub: any,
    daysRemaining: number,
  ): Promise<{ action: string; message: string }> {
    // Only process renewal on day 0
    if (daysRemaining > 0) {
      if (this.REMINDER_DAYS.includes(daysRemaining)) {
        await this.sendNotification(
          sub.customer_id,
          '📋 Subscription Renewal Approaching',
          `Your postpaid subscription #${sub.subscription_number} renews in ${daysRemaining} day(s).`,
          'info',
        );
        return { action: 'reminder', message: `Reminder sent (${daysRemaining} days remaining)` };
      }
      return { action: 'skipped', message: `Not a reminder day` };
    }

    // Day 0 — check outstanding bills
    const hasConsecutiveUnpaid = await this.repository.hasConsecutiveUnpaidCycles(sub.customer_id);
    await this.logAction(sub.subscription_id, 'outstanding_bill_validation', {
      hasConsecutiveUnpaid,
      rule: '2_consecutive_unpaid_cycles',
    });

    if (hasConsecutiveUnpaid) {
      // 2 consecutive unpaid — expire
      await this.expireSubscription(
        sub,
        'Two consecutive unpaid postpaid billing cycles.',
        'Subscription expired. Outstanding dues must be cleared.',
      );
      return { action: 'expired', message: 'Expired due to 2 consecutive unpaid bills' };
    }

    // All clear — renew
    return this.executePostpaidRenewal(sub);
  }

  /**
   * Execute postpaid renewal: extend end_date, create unpaid bill.
   */
  private async executePostpaidRenewal(
    sub: any,
  ): Promise<{ action: string; message: string }> {
    const renewalAmount = await this.repository.calculateRenewalAmount(sub.subscription_id);
    const oldEndDate = this.formatDate(sub.end_date);
    const newEndDate = this.calculateNewEndDate(sub.end_date, 'postpaid');
    const billId = generateId('BILL', 15);

    // Check for duplicate bill
    const billExists = await this.repository.checkBillExistsForPeriod(
      sub.subscription_id,
      oldEndDate,
      newEndDate,
    );
    if (billExists) {
      return { action: 'skipped', message: 'Bill already exists for this period' };
    }

    await this.db.transaction(async (client) => {
      // 1. Extend subscription end_date
      await this.repository.updateSubscriptionStatus(
        sub.subscription_id,
        'active',
        newEndDate,
        client,
      );

      // 2. Create unpaid postpaid bill
      await this.repository.insertCustomerBill(
        {
          bill_id: billId,
          customer_id: sub.customer_id,
          bill_type: 'subscription',
          reference_id: sub.subscription_id,
          payment_type: 'postpaid',
          billing_from: oldEndDate,
          billing_to: newEndDate,
          due_date: this.addDays(newEndDate, 5),
          subtotal: renewalAmount,
          total_amount: renewalAmount,
          paid_amount: 0,
          due_amount: renewalAmount,
          status: 'unpaid',
          remarks: `Postpaid auto-renewal for subscription #${sub.subscription_number}`,
        },
        client,
      );

      // 3. Log
      await this.repository.insertRenewalAttempt(
        {
          subscription_id: sub.subscription_id,
          customer_id: sub.customer_id,
          attempt_type: 'auto_renew',
          payment_type: 'postpaid',
          renewal_amount: renewalAmount,
          bill_id: billId,
          status: 'success',
          old_end_date: oldEndDate,
          new_end_date: newEndDate,
        },
        client,
      );

      await this.repository.insertSubscriptionLog(
        {
          subscription_id: sub.subscription_id,
          action: 'renewed',
          old_data: { end_date: oldEndDate },
          new_data: { end_date: newEndDate, bill_id: billId, payment_type: 'postpaid' },
          created_by: 'system',
        },
        client,
      );
    });

    await this.sendNotification(
      sub.customer_id,
      'Subscription renewed successfully',
      `Your postpaid subscription #${sub.subscription_number} has been renewed until ${newEndDate}. Bill of ₹${renewalAmount.toFixed(0)} generated.`,
      'success',
    );
    await this.sendPushNotification(
      sub.customer_id,
      'Subscription renewed successfully',
      `Your subscription is active until ${newEndDate}. Bill of ₹${renewalAmount.toFixed(0)} generated.`,
    );

    return { action: 'renewed', message: `Postpaid renewal successful — bill ₹${renewalAmount}` };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ADMIN ACTIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Admin: manually renew a subscription.
   */
  async manualRenew(subscriptionId: string): Promise<{ action: string; message: string }> {
    const sub = await this.repository.getSubscriptionWithCustomer(subscriptionId);
    if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

    const paymentType = String(sub.payment_type).toLowerCase();
    if (paymentType === 'prepaid') {
      const renewalAmount = await this.repository.calculateRenewalAmount(subscriptionId);
      const walletBalance = Number(sub.wallet_balance || 0);
      if (walletBalance < renewalAmount) {
        throw new Error(`Insufficient wallet balance. Required: ₹${renewalAmount}, Available: ₹${walletBalance}`);
      }
      return this.executePrepaidRenewal(sub, renewalAmount, walletBalance);
    } else {
      return this.executePostpaidRenewal(sub);
    }
  }

  /**
   * Admin: retry wallet deduction for a failed prepaid renewal.
   */
  async retryWalletDeduction(subscriptionId: string): Promise<{ action: string; message: string }> {
    const sub = await this.repository.getSubscriptionWithCustomer(subscriptionId);
    if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

    const renewalAmount = await this.repository.calculateRenewalAmount(subscriptionId);
    const walletBalance = Number(sub.wallet_balance || 0);

    if (walletBalance < renewalAmount) {
      await this.repository.insertRenewalAttempt({
        subscription_id: subscriptionId,
        customer_id: sub.customer_id,
        attempt_type: 'retry',
        payment_type: 'prepaid',
        renewal_amount: renewalAmount,
        wallet_balance_at_attempt: walletBalance,
        status: 'failed_insufficient_balance',
        failure_reason: `Manual retry failed — Wallet ₹${walletBalance} < Required ₹${renewalAmount}`,
        old_end_date: this.formatDate(sub.end_date),
      });
      throw new Error(`Still insufficient. Wallet: ₹${walletBalance}, Required: ₹${renewalAmount}`);
    }

    return this.executePrepaidRenewal(sub, renewalAmount, walletBalance);
  }

  /**
   * Admin: override renewal — force renew regardless of balance/outstanding.
   */
  async overrideRenewal(subscriptionId: string): Promise<{ action: string; message: string }> {
    const sub = await this.repository.getSubscriptionWithCustomer(subscriptionId);
    if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

    const paymentType = String(sub.payment_type).toLowerCase();
    const renewalAmount = await this.repository.calculateRenewalAmount(subscriptionId);
    const oldEndDate = this.formatDate(sub.end_date);
    const newEndDate = this.calculateNewEndDate(sub.end_date, paymentType);
    const billId = generateId('BILL', 15);

    await this.db.transaction(async (client) => {
      await this.repository.updateSubscriptionStatus(subscriptionId, 'active', newEndDate, client);

      await this.repository.insertCustomerBill(
        {
          bill_id: billId,
          customer_id: sub.customer_id,
          bill_type: 'subscription',
          reference_id: subscriptionId,
          payment_type: paymentType,
          billing_from: oldEndDate,
          billing_to: newEndDate,
          due_date: this.addDays(newEndDate, 5),
          subtotal: renewalAmount,
          total_amount: renewalAmount,
          paid_amount: 0,
          due_amount: renewalAmount,
          status: paymentType === 'prepaid' ? 'paid' : 'unpaid',
          remarks: 'Admin override renewal',
        },
        client,
      );

      await this.repository.insertRenewalAttempt(
        {
          subscription_id: subscriptionId,
          customer_id: sub.customer_id,
          attempt_type: 'manual',
          payment_type: paymentType,
          renewal_amount: renewalAmount,
          wallet_balance_at_attempt: Number(sub.wallet_balance || 0),
          bill_id: billId,
          status: 'success',
          old_end_date: oldEndDate,
          new_end_date: newEndDate,
        },
        client,
      );

      await this.repository.insertSubscriptionLog(
        {
          subscription_id: subscriptionId,
          action: 'admin_override_renewal',
          old_data: { end_date: oldEndDate, status: sub.status },
          new_data: { end_date: newEndDate, bill_id: billId },
          created_by: 'admin',
        },
        client,
      );
    });

    await this.sendNotification(
      sub.customer_id,
      '✅ Subscription Renewed by Admin',
      `Your subscription #${sub.subscription_number} has been renewed until ${newEndDate}.`,
      'success',
    );

    return { action: 'renewed', message: `Admin override renewal successful — new end date ${newEndDate}` };
  }

  /**
   * Admin: get renewal status for a subscription.
   */
  async getRenewalStatus(subscriptionId: string): Promise<any> {
    const sub = await this.repository.getSubscriptionWithCustomer(subscriptionId);
    if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

    const latestAttempt = await this.repository.getLatestRenewalAttempt(subscriptionId);
    const unpaidBills = await this.repository.getUnpaidPostpaidBills(sub.customer_id);
    const renewalAmount = await this.repository.calculateRenewalAmount(subscriptionId);

    return {
      subscription_id: subscriptionId,
      customer_id: sub.customer_id,
      customer_name: sub.first_name || 'Customer',
      status: sub.status,
      payment_type: sub.payment_type,
      auto_renew: sub.auto_renew,
      start_date: sub.start_date,
      end_date: sub.end_date,
      wallet_balance: Number(sub.wallet_balance || 0),
      is_postpaid_enabled: sub.is_postpaid_enabled,
      postpaid_credit_limit: Number(sub.postpaid_credit_limit || 0),
      renewal_amount: renewalAmount,
      outstanding_bills: unpaidBills,
      outstanding_total: unpaidBills.reduce((sum: number, b: any) => sum + Number(b.due_amount || 0), 0),
      latest_renewal_attempt: latestAttempt,
      next_renewal_date: sub.end_date,
      renewal_failure_reason: latestAttempt?.failure_reason || null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SHARED HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  private async completeSubscription(
    sub: any,
    reason: string,
    customMessage?: string,
  ): Promise<void> {
    await this.repository.updateSubscriptionStatus(sub.subscription_id, 'completed');

    await this.logAction(sub.subscription_id, 'completed', {
      reason,
      end_date: this.formatDate(sub.end_date),
    });

    const msg = customMessage || 'Subscription completed. Renew subscription.';
    await this.sendNotification(
      sub.customer_id,
      'Subscription completed',
      msg,
      'info',
    );
    await this.sendPushNotification(
      sub.customer_id,
      'Subscription completed',
      msg,
    );
  }

  private async expireSubscription(
    sub: any,
    reason: string,
    customMessage?: string,
  ): Promise<void> {
    await this.repository.updateSubscriptionStatus(sub.subscription_id, 'expired');

    await this.repository.insertRenewalAttempt({
      subscription_id: sub.subscription_id,
      customer_id: sub.customer_id,
      attempt_type: 'auto_renew',
      payment_type: String(sub.payment_type).toLowerCase(),
      renewal_amount: 0,
      status: 'failed_outstanding',
      failure_reason: reason,
      old_end_date: this.formatDate(sub.end_date),
    });

    await this.logAction(sub.subscription_id, 'expired', { reason });

    const msg = customMessage || 'Subscription expired. Outstanding dues must be cleared.';
    await this.sendNotification(
      sub.customer_id,
      'Subscription expired',
      msg,
      'error',
    );
    await this.sendPushNotification(
      sub.customer_id,
      'Subscription expired',
      msg,
    );
  }

  private async sendNotification(
    customerId: string,
    title: string,
    message: string,
    type: 'success' | 'info' | 'warning' | 'error',
  ): Promise<void> {
    try {
      await this.notificationService.sendNotification({
        title,
        message,
        type,
        priority: type === 'error' ? 'high' : 'medium',
        recipientIds: [customerId],
        senderId: 'system',
      });
    } catch (err: any) {
      this.logger.error(`Failed to send in-app notification to ${customerId}: ${err.message}`);
    }
  }

  private async sendPushNotification(
    customerId: string,
    title: string,
    body: string,
  ): Promise<void> {
    try {
      await this.pushNotificationService.sendNotificationToUsers([customerId], { title, body });
    } catch (err: any) {
      this.logger.error(`Failed to send push notification to ${customerId}: ${err.message}`);
    }
  }

  private async sendEmailNotification(
    customerId: string,
    title: string,
    message: string,
  ): Promise<void> {
    try {
      const sql = `SELECT email, first_name FROM customers WHERE customer_id = $1 LIMIT 1`;
      const res = await this.db.query(sql, [customerId]);
      const customer = res?.[0];
      if (customer && customer.email) {
        this.logger.log(`[Email Template Dispatch] To: ${customer.email} | Subject: ${title} | Body: Hi ${customer.first_name || 'Valued Customer'}, ${message}`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to send email notification to ${customerId}: ${err.message}`);
    }
  }

  private async dispatchMultiChannelNotification(
    customerId: string,
    title: string,
    message: string,
    type: 'success' | 'info' | 'warning' | 'error',
    subscriptionId?: string,
  ): Promise<void> {
    await Promise.allSettled([
      this.sendNotification(customerId, title, message, type),
      this.sendPushNotification(customerId, title, message),
      this.sendEmailNotification(customerId, title, message),
    ]);

    if (subscriptionId) {
      await this.logAction(subscriptionId, 'notification_sent', { title, message, type, channels: ['in_app', 'push', 'email'] });
    }
  }

  private async logAction(
    subscriptionId: string,
    action: string,
    data: any,
  ): Promise<void> {
    try {
      await this.repository.insertSubscriptionLog({
        subscription_id: subscriptionId,
        action,
        new_data: data,
        created_by: 'system',
      });
    } catch (err: any) {
      this.logger.error(`Failed to log action ${action} for ${subscriptionId}: ${err.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  UTILITIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Calculate new end_date after renewal.
   * Prepaid: +1 month (last day of next month from current end_date)
   * Postpaid: +2 months (last day of month+2 from current end_date)
   */
  private calculateNewEndDate(currentEndDate: Date | string, paymentType: string): string {
    const d = new Date(currentEndDate);
    const monthsToAdd = paymentType === 'postpaid' ? 2 : 1;
    const newDate = new Date(d.getFullYear(), d.getMonth() + monthsToAdd + 1, 0); // last day
    return this.formatDate(newDate);
  }

  /**
   * Check if today is a target processing day (7, 5, 3, 1, or 0 days before month end).
   */
  shouldRunToday(): boolean {
    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysBeforeMonthEnd = lastDayOfMonth - now.getDate();
    return this.TARGET_DAYS.includes(daysBeforeMonthEnd);
  }

  private formatDate(d: Date | string): string {
    const date = new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return this.formatDate(d);
  }
}
