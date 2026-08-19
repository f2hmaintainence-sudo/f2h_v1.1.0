import { Module } from '@nestjs/common';
import { HelpersModule } from '../../../helpers/Helpers.module';
import { ConfigModule } from '@nestjs/config';
import { DataService } from '../../../shared/database/Data.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from '../../../shared/logger/Developer.service';
import { PushNotificationService } from '../../../shared/pushNotifications/pushNotification.service';
import { WalletController } from './wallet.controller';
import { WalletReconciliationService } from './wallet-reconciliation.service';
import { WalletReconciliationController } from './wallet-reconciliation.controller';

@Module({
  imports: [
    ConfigModule,
    HelpersModule,
  ],
  controllers: [WalletController, WalletReconciliationController],
  providers: [
    DataService,
    DatabaseService,
    DeveloperService,
    PushNotificationService,
    WalletReconciliationService,
  ],
  exports: [WalletReconciliationService],
})
export class WalletModule {}