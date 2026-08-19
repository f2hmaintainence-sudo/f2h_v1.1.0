import { Module } from '@nestjs/common';
import { FinanceController, CustomerBillsController } from './finance.controller';
import { FinanceService } from './services/finance.service';
import { FinanceRepository } from './repository/finance.repository';
import { NotificationModule } from 'src/notifications/notification.module';
import { AdminAuthModule } from 'src/panels/admin/auth/auth.module';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';

@Module({
  imports: [NotificationModule, AdminAuthModule],
  controllers: [FinanceController, CustomerBillsController],
  providers: [
    FinanceService,
    FinanceRepository,
    PushNotificationService,
    DatabaseService,
    DataService,
    DeveloperService,
  ],
  exports: [FinanceService, FinanceRepository],
})
export class FinanceModule {}
