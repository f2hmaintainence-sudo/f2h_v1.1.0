import { Module } from '@nestjs/common';
import { RedisModule } from '../../../../../shared/redis/redis.module';
import { DatabaseService } from '../../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { DataService } from '../../../../../shared/database/Data.service';
import { PushNotificationService } from '../../../../../shared/pushNotifications/pushNotification.service';
import { NotificationModule } from '../../../../../notifications/notification.module';
import { AdminAuthModule } from '../../../../admin/auth/auth.module';
import { SubscriptionStatusCron } from './subscription-status.cron';
import { SubscriptionStatusRepository } from './subscription-status.repository';
import { SubscriptionStatusService } from './subscription-status.service';

@Module({
  imports: [RedisModule, NotificationModule, AdminAuthModule],
  providers: [
    DatabaseService,
    DeveloperService,
    DataService,
    PushNotificationService,
    SubscriptionStatusCron,
    SubscriptionStatusRepository,
    SubscriptionStatusService,
  ],
  exports: [SubscriptionStatusService],
})
export class SubscriptionStatusModule {}
