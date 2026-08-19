import { Module } from '@nestjs/common';
import {
  CustomerPaymentController,
  RazorpayWebhookController,
} from './payment.controller';
import { CustomerPaymentService } from './payment.service';
import { PaymentReconciliationCron } from './payment-reconciliation.cron';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';
import { DataService } from 'src/shared/database/Data.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';

@Module({
  controllers: [CustomerPaymentController, RazorpayWebhookController],
  providers: [
    CustomerPaymentService,
    PaymentReconciliationCron,
    PushNotificationService,
    DataService,
    DatabaseService,
    DeveloperService,
  ],
  exports: [CustomerPaymentService],
})
export class CustomerPaymentModule {}
