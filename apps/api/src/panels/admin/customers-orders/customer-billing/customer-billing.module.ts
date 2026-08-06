import { Module } from '@nestjs/common';
import {
  CustomerBillingApiController,
  CustomerBillingAdminController,
} from './customer-billing.controller';
import { CustomerBillingService } from './services/customer-billing.service';
import { CustomerBillingRepository } from './repository/customer-billing.repository';
import { NotificationModule } from 'src/notifications/notification.module';
import { AdminAuthModule } from 'src/panels/admin/auth/auth.module';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';

@Module({
  imports: [NotificationModule, AdminAuthModule],
  controllers: [
    CustomerBillingApiController,
    CustomerBillingAdminController,
  ],
  providers: [
    CustomerBillingService,
    CustomerBillingRepository,
    PushNotificationService,
    DataService,
    DeveloperService,
  ],
  exports: [CustomerBillingService, CustomerBillingRepository],
})
export class CustomerBillingModule {}
