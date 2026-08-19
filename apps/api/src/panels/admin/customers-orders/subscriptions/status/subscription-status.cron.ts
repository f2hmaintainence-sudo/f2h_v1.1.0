import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SubscriptionStatusService } from './subscription-status.service';
import { NotificationService } from '../../../../../notifications/notification.service';
import { AuthService } from '../../../../admin/auth/auth.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { CronLockService } from 'src/shared/scheduling/cron-lock.service';

@Injectable()
export class SubscriptionStatusCron {
  private readonly logger = new Logger(SubscriptionStatusCron.name);

  constructor(
    private readonly statusService: SubscriptionStatusService,
    private readonly notificationService: NotificationService,
    private readonly authServices: AuthService,
    private readonly developer: DeveloperService,
    private readonly cronLock: CronLockService,
  ) {}

  /**
   * Subscription Status Processing
   * Runs daily at 1:00 AM IST.
   *
   * The service internally checks shouldRunToday() and only processes
   * on days that are 7, 5, 3, 1, or 0 days before month end.
   *
   * Handles:
   *  - Prepaid renewal (wallet deduction)
   *  - Postpaid renewal (outstanding bill validation)
   *  - Subscription completion
   *  - Subscription expiration
   *  - Reminder notifications
   */
  @Cron('0 0 1 * * *', {
    timeZone: 'Asia/Kolkata',
  })
  async handleSubscriptionStatusProcessing(): Promise<void> {
    // Only one instance may run this tick — see CronLockService.
    if (!(await this.cronLock.acquire('handleSubscriptionStatusProcessing', 3600))) return;

    this.logger.log('[CRON] Starting Subscription Status Processing...');

    try {
      const result = await this.statusService.processSubscriptionStatuses();

      // Skip admin notification if nothing was processed (not a target day)
      if (result.processedCount === 0 && result.skippedCount === 0) {
        this.logger.log('[CRON] Not a target day — no subscriptions processed.');
        return;
      }

      this.logger.log(
        `[CRON] Subscription Status Processing done: ` +
        `processed=${result.processedCount} renewed=${result.renewedCount} ` +
        `completed=${result.completedCount} expired=${result.expiredCount} ` +
        `reminders=${result.remindersSent} failed=${result.failedCount} ` +
        `duration=${result.durationMs}ms`,
      );

      // Notify admins about the processing results
      try {
        const adminUsersRes = await this.authServices.getUsersByRole('ADMIN');
        const adminUserIds = adminUsersRes.user_ids || [];

        if (adminUserIds.length > 0 && result.processedCount > 0) {
          const title = '📊 Subscription Status Processing Complete';
          const message =
            `Processed ${result.processedCount} subscriptions:\n` +
            `✅ Renewed: ${result.renewedCount}\n` +
            `📋 Completed: ${result.completedCount}\n` +
            `❌ Expired: ${result.expiredCount}\n` +
            `🔔 Reminders: ${result.remindersSent}\n` +
            `⚠️ Failed: ${result.failedCount}\n` +
            `⏱️ Duration: ${result.durationMs}ms`;

          await this.notificationService.sendNotification({
            title,
            message,
            type: result.failedCount > 0 ? 'warning' : 'info',
            priority: 'high',
            recipientIds: adminUserIds,
            senderId: 'system',
          });
        }
      } catch (notifErr: any) {
        this.logger.error(`[CRON] Failed to send admin notification: ${notifErr.message}`);
      }
    } catch (error: any) {
      this.logger.error(
        `[CRON] Subscription Status Processing failed: ${error.message}`,
        error.stack,
      );
    }
  }
}
