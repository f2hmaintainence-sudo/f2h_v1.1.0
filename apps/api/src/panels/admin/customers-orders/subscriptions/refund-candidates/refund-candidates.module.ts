import { Module } from '@nestjs/common';
import { DatabaseService } from '../../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { RefundCandidatesController } from './refund-candidates.controller';
import { RefundCandidatesRepository } from './refund-candidates.repository';
import { RefundCandidatesService } from './refund-candidates.service';

@Module({
  controllers: [RefundCandidatesController],
  providers: [
    RefundCandidatesService,
    RefundCandidatesRepository,
    DatabaseService,
    DeveloperService,
  ],
  exports: [RefundCandidatesService, RefundCandidatesRepository],
})
export class RefundCandidatesModule {}
