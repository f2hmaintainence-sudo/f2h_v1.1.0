import { Module } from '@nestjs/common';
import { RedisModule } from '../../../../../shared/redis/redis.module';
import { DatabaseService } from '../../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { SubscriptionSnapshotCron } from './subscription-snapshot.cron';
import { SubscriptionSnapshotRepository } from './repository/subscription-snapshot.repository';
import { SubscriptionSnapshotService } from './services/subscription-snapshot.service';
import { DispatchController } from './dispatch.controller';
import { PdfModule } from '../../../../../common/pdf';
import { NotificationModule } from 'src/notifications/notification.module';
import { AdminAuthModule } from 'src/panels/admin/auth/auth.module';

@Module({
  imports: [RedisModule, PdfModule, NotificationModule, AdminAuthModule],
  controllers: [DispatchController],
  providers: [
    DeveloperService,
    SubscriptionSnapshotCron,
    SubscriptionSnapshotRepository,
    SubscriptionSnapshotService,
  ],
  exports: [SubscriptionSnapshotService],
})
export class SubscriptionSnapshotModule {}
