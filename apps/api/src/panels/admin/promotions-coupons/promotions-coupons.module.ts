import { Module } from '@nestjs/common';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';
import { PromotionsCouponsController } from './promotions-coupons.controller';
import { PromotionsCouponsService } from './promotions-coupons.service';

@Module({
  controllers: [PromotionsCouponsController],
  providers: [DatabaseService, DataService, DeveloperService, PushNotificationService, PromotionsCouponsService],
  exports: [PromotionsCouponsService],
})
export class PromotionsCouponsModule {}
