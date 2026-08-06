import { Injectable } from '@nestjs/common';
import { CalendarService } from '../calendar.service';
import { MonthlyCalendarQueryDto } from '../dto/calendar.dto';

@Injectable()
export class GetMonthlyCalendarHandler {
  constructor(private readonly calendarService: CalendarService) {}

  execute(query: MonthlyCalendarQueryDto) {
    return this.calendarService.getMonthlyCalendar(query);
  }
}
