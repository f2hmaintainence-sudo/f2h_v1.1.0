import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SubscriptionSnapshotService } from './services/subscription-snapshot.service';
import { NotificationService } from 'src/notifications/notification.service';
import { AuthService } from 'src/panels/admin/auth/auth.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';

import { DatabaseService } from '../../../../../shared/database/Database.service';
import { CronLockService } from 'src/shared/scheduling/cron-lock.service';

@Injectable()
export class SubscriptionSnapshotCron {
  private readonly logger = new Logger(SubscriptionSnapshotCron.name);

  constructor(
    private readonly snapshotService: SubscriptionSnapshotService,
    private readonly notificationService: NotificationService,
    private readonly authServices: AuthService,
    private readonly developerService: DeveloperService,
    private readonly db: DatabaseService,
    private readonly cronLock: CronLockService,
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
    // Only one instance may run this tick — see CronLockService.
    if (!(await this.cronLock.acquire('handleMorningOrderProcessing', 3600))) return;

    const targetDate = this.snapshotService.getIstDate(1); // Next day
    const slot = 'morning' as const;

    this.logger.log(
      `[CRON] Starting Morning Order Processing for ${targetDate}`,
    );

    try {
      const result = await this.snapshotService.generateOrdersForDateAndSlot(
        targetDate,
        slot,
        'cron',
      );
      this.logger.log(
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
      this.logger.log('notifications=========',notification);

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
    // Only one instance may run this tick — see CronLockService.
    if (!(await this.cronLock.acquire('handleEveningOrderProcessing', 3600))) return;

    const targetDate = this.snapshotService.getIstDate(0); // Same day
    const slot = 'evening' as const;

    this.logger.log(
      `[CRON] Starting Evening Order Processing for ${targetDate}`,
    );

    try {
      const result = await this.snapshotService.generateOrdersForDateAndSlot(
        targetDate,
        slot,
        'cron',
      );
      this.logger.log(
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
}
