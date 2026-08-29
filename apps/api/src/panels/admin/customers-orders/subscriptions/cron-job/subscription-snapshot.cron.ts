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
  private cachedSlotTimings: any = null;
  private lastSlotTimingsFetch = 0;

  constructor(
    private readonly snapshotService: SubscriptionSnapshotService,
    private readonly notificationService: NotificationService,
    private readonly authServices: AuthService,
    private readonly developerService: DeveloperService,
    private readonly db: DatabaseService,
    private readonly cronLock: CronLockService,
  ) { }

  /**
   * Fetches slot_timings from system_configurations with a 30s cache.
   */
  private async getSlotTimingsConfig(): Promise<any> {
    const now = Date.now();
    if (this.cachedSlotTimings && now - this.lastSlotTimingsFetch < 30000) {
      return this.cachedSlotTimings;
    }
    try {
      const rows = await this.db.query(
        `SELECT config_data FROM system_configurations WHERE config_key = 'slot_timings' AND is_active = true LIMIT 1`,
      );
      if (rows?.[0]?.config_data) {
        this.cachedSlotTimings = rows[0].config_data;
        this.lastSlotTimingsFetch = now;
        return this.cachedSlotTimings;
      }
    } catch (err) {
      this.logger.warn(`Failed to fetch slot_timings from system_configurations: ${err}`);
    }

    return {
      morning_slot: {
        is_enabled: true,
        cron_run_time: '20:30',
        cron_run_day_offset: -1,
      },
      evening_slot: {
        is_enabled: true,
        cron_run_time: '14:30',
        cron_run_day_offset: 0,
      },
    };
  }

  /**
   * Dynamic Cron Dispatcher
   * Runs every minute and checks if current IST time matches the configured
   * "Delivery Run Generation Cron Time" for Morning or Evening slot.
   */
  @Cron('* * * * *', {
    timeZone: 'Asia/Kolkata',
  })
  async handleDynamicOrderProcessingDispatcher(): Promise<void> {
    const kolkataTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());

    const slotTimings = await this.getSlotTimingsConfig();
    const morningSlot = slotTimings?.morning_slot;
    const eveningSlot = slotTimings?.evening_slot;

    // Morning slot check
    const morningCronTime = morningSlot?.cron_run_time || '20:30';
    if (morningSlot?.is_enabled !== false && kolkataTime === morningCronTime) {
      const dayOffset = morningSlot?.cron_run_day_offset === 0 ? 0 : 1;
      await this.runMorningProcessing(dayOffset, morningCronTime);
    }

    // Evening slot check
    const eveningCronTime = eveningSlot?.cron_run_time || '14:30';
    if (eveningSlot?.is_enabled !== false && kolkataTime === eveningCronTime) {
      const dayOffset = eveningSlot?.cron_run_day_offset === -1 ? 1 : 0;
      await this.runEveningProcessing(dayOffset, eveningCronTime);
    }
  }

  /**
   * Processes Morning deliveries:
   *  1. Generates subscription orders
   *  2. Confirms eligible one-time orders (placed → confirmed)
   */
  async runMorningProcessing(dayOffset = 1, cronTime = '20:30'): Promise<void> {
    const targetDate = this.snapshotService.getIstDate(dayOffset);
    const lockKey = `handleMorningOrderProcessing:${targetDate}:${cronTime}`;
    if (!(await this.cronLock.acquire(lockKey, 3600))) return;

    const slot = 'morning' as const;

    this.logger.log(
      `[CRON] Starting Dynamic Morning Order Processing for target date ${targetDate} (scheduled at ${cronTime} IST)`,
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
      const message = `${targetDate} morning cron job completed. ${result.totalProcessed} total orders across ${result.branchStats.length} branches in ${result.durationMs}ms.`;

      this.developerService.info('Sending Morning cron completion notification to admins', {
        adminUserIds,
        title,
        message,
      });

      await this.notificationService.sendNotification({
        title,
        message,
        type: 'info',
        priority: 'high',
        recipientIds: adminUserIds,
        senderId: 'system',
      });

      this.developerService.info('Morning cron completion notification sent successfully', {
        status: 'success',
      });
    } catch (error) {
      this.logger.error(
        `[CRON] Morning Order Processing failed for ${targetDate}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Processes Evening deliveries:
   *  1. Generates subscription orders
   *  2. Confirms eligible one-time orders (placed → confirmed)
   */
  async runEveningProcessing(dayOffset = 0, cronTime = '14:30'): Promise<void> {
    const targetDate = this.snapshotService.getIstDate(dayOffset);
    const lockKey = `handleEveningOrderProcessing:${targetDate}:${cronTime}`;
    if (!(await this.cronLock.acquire(lockKey, 3600))) return;

    const slot = 'evening' as const;

    this.logger.log(
      `[CRON] Starting Dynamic Evening Order Processing for target date ${targetDate} (scheduled at ${cronTime} IST)`,
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
      const message = `${targetDate} evening cron job completed. ${result.totalProcessed} total orders across ${result.branchStats.length} branches in ${result.durationMs}ms.`;

      this.developerService.info('Sending Evening cron completion notification to admins', {
        adminUserIds,
        title,
        message,
      });

      await this.notificationService.sendNotification({
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
      this.logger.error(
        `[CRON] Evening Order Processing failed for ${targetDate}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

