import { Module } from '@nestjs/common';
import { DeliveryOrderController } from './controllers/delivery.order.controller';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { HelpersModule } from 'src/helpers/Helpers.module';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';

@Module({
  imports: [HelpersModule],
  controllers: [DeliveryOrderController],
  providers: [DeveloperService, PushNotificationService, DataService],
})
export class DeliveryOrdersModule {}
