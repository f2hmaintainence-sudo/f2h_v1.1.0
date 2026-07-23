import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SubscriptionSnapshotService } from './services/subscription-snapshot.service';
import { NotificationService } from 'src/notifications/notification.service';
import { AuthService } from 'src/panels/admin/auth/auth.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';

import { DatabaseService } from '../../../../../shared/database/Database.service';

@Injectable()
export class SubscriptionSnapshotCron {
  private readonly logger = new Logger(SubscriptionSnapshotCron.name);

  constructor(
    private readonly snapshotService: SubscriptionSnapshotService,
    private readonly notificationService: NotificationService,
    private readonly authServices: AuthService,
    private readonly developerService: DeveloperService,
    private readonly db: DatabaseService,
  ) { }

  /**
   * Morning Order Processing
   * Runs daily at 23:55 (11:55 PM) IST
   *
   * Processes next day's Morning deliveries for ALL branches:
   *  1. Generates subscription orders
   *  2. Confirms eligible one-time orders (placed → confirmed)
   */
  @Cron('0 55 23 * * *', {
    timeZone: 'Asia/Kolkata',
  })
  async handleMorningOrderProcessing(): Promise<void> {
    const targetDate = this.snapshotService.getIstDate(1); // Next day
    const slot = 'morning' as const;

    console.log(
      `[CRON] Starting Morning Order Processing for ${targetDate}`,
    );

    try {
      const result = await this.snapshotService.generateOrdersForDateAndSlot(
        targetDate,
        slot,
        'cron',
      );
      console.log(
        `[CRON] Morning processing done: ` +
        `sub_orders=${result.subscriptionOrdersCreated} ` +
        `sub_items=${result.subscriptionItemsInserted} ` +
        `onetime_confirmed=${result.onetimeOrdersConfirmed} ` +
        `onetime_skipped=${result.onetimeOrdersSkipped} ` +
        `total=${result.totalProcessed} ` +
        `branches=${result.branchStats.length} ` +
        `duration=${result.durationMs}ms`,
      );
      const adminUsersRes = await this.authServices.getUsersByRole('ADMIN');
      const adminUserIds = adminUsersRes.user_ids;

      const title = 'Morning cron job completion';
      const message = `${targetDate} morning cron job completed.${result.totalProcessed} total order.${result.branchStats.length} branches have been processed.${result.durationMs}ms time taken.`;

      this.developerService.info('Sending Morning cron completion notification to admins', {
        adminUserIds,
        title,
        message,
      });

      const notification = await this.notificationService
      .sendNotification({
        title,
        message,
        type: 'info',
        priority: 'high',
        recipientIds: adminUserIds,
        senderId: 'system',
      });
      console.log('notifications=========',notification);

      this.developerService.info('Morning cron completion notification sent successfully', {
        status: 'success',
      });
    } catch (error) {
      console.error(
        `[CRON] Morning Order Processing failed for ${targetDate}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Evening Order Processing
   * Runs daily at 11:55 AM IST
   *
   * Processes the same day's Evening deliveries for ALL branches:
   *  1. Generates subscription orders
   *  2. Confirms eligible one-time orders (placed → confirmed)
   */
  @Cron('0 55 11 * * *', {
    timeZone: 'Asia/Kolkata',
  })
  async handleEveningOrderProcessing(): Promise<void> {
    const targetDate = this.snapshotService.getIstDate(0); // Same day
    const slot = 'evening' as const;

    console.log(
      `[CRON] Starting Evening Order Processing for ${targetDate}`,
    );

    try {
      const result = await this.snapshotService.generateOrdersForDateAndSlot(
        targetDate,
        slot,
        'cron',
      );
      console.log(
        `[CRON] Evening processing done: ` +
        `sub_orders=${result.subscriptionOrdersCreated} ` +
        `sub_items=${result.subscriptionItemsInserted} ` +
        `onetime_confirmed=${result.onetimeOrdersConfirmed} ` +
        `onetime_skipped=${result.onetimeOrdersSkipped} ` +
        `total=${result.totalProcessed} ` +
        `branches=${result.branchStats.length} ` +
        `duration=${result.durationMs}ms`,
      );

      const adminUsersRes = await this.authServices.getUsersByRole('ADMIN');
      const adminUserIds = adminUsersRes.user_ids;

      const title = 'Evening cron job completion';
      const message = `${targetDate} evening cron job completed.${result.totalProcessed} total order.${result.branchStats.length} branches have been processed.${result.durationMs}ms time taken.`;

      this.developerService.info('Sending Evening cron completion notification to admins', {
        adminUserIds,
        title,
        message,
      });

      const notification = await this.notificationService
      .sendNotification({
        title,
        message,
        type: 'info',
        priority: 'high',
        recipientIds: adminUserIds,
        senderId: 'system',
      });

      this.developerService.info('Evening cron completion notification sent successfully', {
        status: 'success',
      });

    } catch (error) {
      console.error(
        `[CRON] Evening Order Processing failed for ${targetDate}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Low Wallet Balance Warning Cron
   * Runs daily at 21:00 (9:00 PM) IST — 1 hour before 10:00 PM cutoff
   *
   * Finds active subscribers whose wallet balance is lower than 3 days of subscription cost,
   * and sends an in-app notification & log warning.
   */
  @Cron('0 0 21 * * *', {
    timeZone: 'Asia/Kolkata',
  })
  async handleLowBalanceWarning(): Promise<void> {
    this.logger.log('[CRON] Starting Low Wallet Balance Check (9:00 PM IST)...');
    try {
      // Find customers with active subscriptions whose wallet_balance < estimated 3 days cost
      const lowBalCustomers = await this.db.query(
        `SELECT s.customer_id, c.full_name, c.wallet_balance,
                SUM(si.final_price * COALESCE(si.default_m_quantity + si.default_e_quantity, 1)) * 3 AS est_3day_cost
         FROM subscriptions s
         JOIN customers c ON c.customer_id = s.customer_id
         JOIN subscription_items si ON si.subscription_id = s.subscription_id AND si.status = 'active'
         WHERE s.status = 'active'
         GROUP BY s.customer_id, c.full_name, c.wallet_balance
         HAVING c.wallet_balance < SUM(si.final_price * COALESCE(si.default_m_quantity + si.default_e_quantity, 1)) * 3`,
        [],
      );

      if (lowBalCustomers?.length) {
        const userIds = lowBalCustomers.map((row: any) => row.customer_id);
        await this.notificationService.sendNotification({
          title: '⚠️ Low Wallet Balance',
          message: 'Your wallet balance is low! Recharge now to ensure uninterrupted daily milk & fresh product delivery.',
          type: 'warning',
          priority: 'high',
          recipientIds: userIds,
          senderId: 'system',
        });
        this.logger.log(`[CRON] Sent low balance notification to ${userIds.length} customers.`);
      }
    } catch (error) {
      this.logger.error('[CRON] Low balance check failed', error instanceof Error ? error.stack : String(error));
    }
  }
}
