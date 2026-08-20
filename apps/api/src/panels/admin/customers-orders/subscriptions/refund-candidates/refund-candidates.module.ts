import { Module } from '@nestjs/common';
import { DatabaseService } from '../../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { PushNotificationService } from '../../../../../shared/pushNotifications/pushNotification.service';
import { WalletLedgerService } from '../../../../../shared/payments/wallet-ledger.service';
import { RefundCandidatesController } from './refund-candidates.controller';
import { RefundCandidatesRepository } from './refund-candidates.repository';
import { RefundCandidatesService } from './refund-candidates.service';
import { RefundEligibilityService } from './refund-eligibility.service';
import { RefundProcessingService } from './refund-processing.service';

@Module({
  controllers: [RefundCandidatesController],
  providers: [
    RefundCandidatesService,
    RefundCandidatesRepository,
    RefundEligibilityService,
    RefundProcessingService,
    WalletLedgerService,
    PushNotificationService,
    DatabaseService,
    DeveloperService,
  ],
  exports: [
    RefundCandidatesService,
    RefundCandidatesRepository,
    RefundEligibilityService,
    RefundProcessingService,
  ],
})
export class RefundCandidatesModule {}
