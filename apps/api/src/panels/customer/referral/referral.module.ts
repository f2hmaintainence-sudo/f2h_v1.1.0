import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DataService } from 'src/shared/database/Data.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { ReferralController } from './referral.controller';
import { ReferralService } from './services/referral.service';
import { ReferralRepository } from './repositories/referral.repository';
import { FirstOrderDetectorService } from './services/first-order-detector.service';
import { ReferralRewardEngineService } from './services/referral-reward-engine.service';
import { OrderDeliveredListener } from './listeners/order-delivered.listener';

@Module({
  imports: [ConfigModule],
  controllers: [ReferralController],
  providers: [
    DataService,
    DatabaseService,
    DeveloperService,
    FirstOrderDetectorService,
    ReferralRewardEngineService,
    OrderDeliveredListener,
    {
      provide: 'IReferralRepository',
      useClass: ReferralRepository,
    },
    {
      provide: 'IReferralService',
      useClass: ReferralService,
    },
  ],
  exports: [
    'IReferralService',
    'IReferralRepository',
    FirstOrderDetectorService,
    ReferralRewardEngineService,
  ],
})
export class ReferralModule {}
