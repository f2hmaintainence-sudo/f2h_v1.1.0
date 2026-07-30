import { Module } from '@nestjs/common';
import { DeliveryManagementController } from './delivery.controller';
import { DeliveryManagementService } from './delivery.service';
import { DeliveryRunService } from './delivery-run.service';
import { DeliveryDispatchService } from './delivery-dispatch.service';
import { StockMovementCoreService } from '../catalog-inventory/inventory/services/stock-movement-core.service';
import { HelpersModule } from '../../../helpers/Helpers.module';
import { DeveloperService } from '../../../shared/logger/Developer.service';
import { NotificationModule } from 'src/notifications/notification.module';
import { AdminAuthModule } from 'src/panels/admin/auth/auth.module';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';
import { DataService } from 'src/shared/database/Data.service';
import { RedisService } from 'src/shared/redis/redis.service';

import { DeliveryShowAddService } from './services/showAdd.service';
import { DeliverySaveAddService } from './services/saveAdd.service';
import { DeliveryShowEditService } from './services/showEdit.service';
import { DeliverySaveEditService } from './services/saveEdit.service';
import { DeliveryLeaveTableService } from './services/table.service';
import { DeliveryLeaveShowEditService, DeliveryLeaveSaveEditService } from './services/leave-edit.service';

import { ReferralModule } from '../../customer/referral/referral.module';

@Module({
  imports: [HelpersModule, NotificationModule, AdminAuthModule, ReferralModule],
  controllers: [DeliveryManagementController],
  providers: [
    DeliveryManagementService,
    DeliveryRunService,
    DeliveryDispatchService,
    StockMovementCoreService,
    DeveloperService,
    PushNotificationService,
    DataService,
    RedisService,
    DeliveryShowAddService,
    DeliverySaveAddService,
    DeliveryShowEditService,
    DeliverySaveEditService,
    DeliveryLeaveTableService,
    DeliveryLeaveShowEditService,
    DeliveryLeaveSaveEditService,
  ],
  exports: [
    DeliveryManagementService,
    DeliveryRunService,
    DeliveryDispatchService,
    DeliveryShowAddService,
    DeliverySaveAddService,
    DeliveryShowEditService,
    DeliverySaveEditService,
    DeliveryLeaveTableService,
    DeliveryLeaveShowEditService,
    DeliveryLeaveSaveEditService,
  ],
})
export class DeliveryManagementModule {}

