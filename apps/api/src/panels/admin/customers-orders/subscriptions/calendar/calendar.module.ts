import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { RedisModule } from 'src/shared/redis/redis.module';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { CalendarRepository } from './repository/calendar.repository';
import { GetDayDetailsHandler } from './queries/get-day-details.handler';

@Module({
  imports: [RedisModule],
  controllers: [CalendarController],
  providers: [
    CalendarService,
    CalendarRepository,
    GetDayDetailsHandler,
    
    DeveloperService],
  exports: [CalendarService],
})
export class CalendarModule {}
