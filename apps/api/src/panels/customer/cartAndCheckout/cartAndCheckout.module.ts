import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import {
  CartController,
} from './controller/cartAndCheckout.controller';
import { CartService } from './ModuleServices/cartAndCheckout.service';
import { PricingService } from './ModuleServices/pricing.service';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';
import { NotificationModule } from 'src/notifications/notification.module';

import { ReferralModule } from '../referral/referral.module';
import { DiscountEngineModule } from 'src/shared/services/discount-engine.module';
import { CustomerPaymentModule } from '../payment/payment.module';
import { StockAvailabilityService } from 'src/shared/services/stock-availability.service';

@Module({
  imports: [ConfigModule, NotificationModule, ReferralModule, DiscountEngineModule, CustomerPaymentModule],
  controllers: [CartController],
  providers: [DatabaseService, DataService, DeveloperService, CartService, PricingService, PushNotificationService, StockAvailabilityService],
  exports: [CartService, PricingService],
})
export class CartAndCheckoutModule { }
