import { Module } from '@nestjs/common';
import { HelpersModule } from '../../../helpers/Helpers.module';
import { ConfigModule } from '@nestjs/config';
import { DataService } from '../../../shared/database/Data.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from '../../../shared/logger/Developer.service';
import { PushNotificationService } from '../../../shared/pushNotifications/pushNotification.service';
import { WalletController } from './wallet.controller';

@Module({
  imports: [
    ConfigModule,
    HelpersModule,
  ],
  controllers: [WalletController],
  providers: [DataService, DatabaseService, DeveloperService, PushNotificationService],
})
export class WalletModule {}