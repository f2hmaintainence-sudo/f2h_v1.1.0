import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { HelpersModule } from '../../../helpers/Helpers.module';
import { DeveloperService } from '../../../shared/logger/Developer.service';
import { PdfModule } from '../../../common/pdf/pdf.module';
import { WalletLedgerService } from '../../../shared/payments/wallet-ledger.service';
import { PushNotificationService } from '../../../shared/pushNotifications/pushNotification.service';

@Module({
  imports: [HelpersModule, PdfModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    DeveloperService,
    // Refund processing credits wallets through the single ledger writer.
    WalletLedgerService,
    PushNotificationService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
