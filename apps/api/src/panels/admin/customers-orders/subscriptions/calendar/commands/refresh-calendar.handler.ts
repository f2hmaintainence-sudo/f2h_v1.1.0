import { Injectable } from '@nestjs/common';
import { CalendarService } from '../calendar.service';
import { CalendarRefreshDto } from '../dto/calendar.dto';

@Injectable()
export class RefreshCalendarHandler {
  constructor(private readonly calendarService: CalendarService) {}

  execute(command: CalendarRefreshDto) {
    return this.calendarService.enqueueRefresh(command);
  }
}
