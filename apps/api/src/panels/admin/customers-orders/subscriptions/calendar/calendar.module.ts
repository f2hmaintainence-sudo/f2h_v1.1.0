import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { BullModule } from '@nestjs/bullmq';
import { CalendarAggregationProcessor } from './workers/calendar-aggregation.processor';
import { CalendarRefreshProcessor } from './workers/calendar-refresh.processor';
import { CalendarSchedulerService } from './workers/calendar-scheduler.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { RedisModule } from 'src/shared/redis/redis.module';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { CalendarRepository } from './repository/calendar.repository';
import { GetMonthlyCalendarHandler } from './queries/get-monthly-calendar.handler';
import { GetDayDetailsHandler } from './queries/get-day-details.handler';
import { RefreshCalendarHandler } from './commands/refresh-calendar.handler';

@Module({
  imports: [
    RedisModule,
    BullModule.registerQueue({
      name: 'calendar-aggregation-queue',
    }),
    BullModule.registerQueue({
      name: 'calendar-refresh-queue',
    }),
  ],
  controllers: [CalendarController],
  providers: [
    CalendarService,
    CalendarRepository,
    GetMonthlyCalendarHandler,
    GetDayDetailsHandler,
    RefreshCalendarHandler,
    CalendarSchedulerService,
    CalendarAggregationProcessor,
    CalendarRefreshProcessor,
    
    DeveloperService],
  exports: [CalendarService],
})
export class CalendarModule {}
