import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { HelpersModule } from '../../../helpers/Helpers.module';
import { DeveloperService } from '../../../shared/logger/Developer.service';

@Module({
  imports: [HelpersModule],
  controllers: [DashboardController],
  providers: [DashboardService, DeveloperService],
  exports: [DashboardService],
})
export class DashboardModule {}
