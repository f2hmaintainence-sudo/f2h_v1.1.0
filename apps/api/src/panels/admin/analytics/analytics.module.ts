import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { HelpersModule } from '../../../helpers/Helpers.module';
import { DeveloperService } from '../../../shared/logger/Developer.service';
import { PdfModule } from '../../../common/pdf/pdf.module';

@Module({
  imports: [HelpersModule, PdfModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, DeveloperService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
