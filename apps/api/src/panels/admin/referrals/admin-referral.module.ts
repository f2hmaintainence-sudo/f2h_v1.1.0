import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DataService } from 'src/shared/database/Data.service';
import { AdminReferralController } from './admin-referral.controller';
import { AdminReferralService } from './admin-referral.service';

@Module({
  imports: [ConfigModule],
  controllers: [AdminReferralController],
  providers: [DataService, AdminReferralService],
  exports: [AdminReferralService],
})
export class AdminReferralModule {}
