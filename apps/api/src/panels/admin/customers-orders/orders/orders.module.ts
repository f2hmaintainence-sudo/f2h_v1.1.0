import { Module } from '@nestjs/common';
import { HelpersModule } from '../../../../helpers/Helpers.module';
import { FieldEncryptionModule } from '../../../../encryption/field-encryption.module';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { PdfModule } from '../../../../common/pdf/pdf.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersTableService } from './services/table.service';
import { ReferralModule } from '../../../customer/referral/referral.module';
import { PaymentGatewayModule } from '../../../../shared/payments/payment-gateway.module';
import { PushNotificationService } from '../../../../shared/pushNotifications/pushNotification.service';

@Module({
  imports: [
    HelpersModule,
    FieldEncryptionModule,
    PdfModule,
    ReferralModule,
    PaymentGatewayModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersTableService,
    DeveloperService,
    PushNotificationService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
