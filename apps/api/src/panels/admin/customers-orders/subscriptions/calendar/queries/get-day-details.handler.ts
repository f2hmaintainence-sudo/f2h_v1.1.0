import { Injectable } from '@nestjs/common';
import { CalendarService } from '../calendar.service';
import { CalendarDayDetailsQueryDto } from '../dto/calendar.dto';

@Injectable()
export class GetDayDetailsHandler {
  constructor(private readonly calendarService: CalendarService) {}

  execute(query: CalendarDayDetailsQueryDto) {
    return this.calendarService.getDayDetails(query);
  }
}
