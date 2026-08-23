import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';
import { MailService } from 'src/mail/mail.service';
import { NotificationModule } from 'src/notifications/notification.module';
import { CustomerPaymentModule } from '../payment/payment.module';
import {
  SubscriptionsController,
} from './controllers/subscriptions.controller';
import { SubscriptionsService } from './ModuleServices/subscriptions.service';

@Module({
  imports: [ConfigModule, NotificationModule, CustomerPaymentModule],
  controllers: [SubscriptionsController],
  providers: [
    DatabaseService,
    DataService,
    DeveloperService,
    SubscriptionsService,
    PushNotificationService,
    MailService,
  ],
})
export class CustomerSubscriptionsModule { }