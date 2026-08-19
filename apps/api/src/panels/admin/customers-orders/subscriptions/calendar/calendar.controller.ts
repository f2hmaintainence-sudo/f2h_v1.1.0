import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import {
  CalendarDayDetailsQueryDto,
  CalendarRefreshDto,
  MonthlyCalendarQueryDto,
} from './dto/calendar.dto';

@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/subscriptions/calendar', version: '1' })
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) { }

  @Get()
  async getMonthlyCalendar(@Query() query: MonthlyCalendarQueryDto) {
    return this.calendarService.getMonthlyCalendar(query);
  }

  @Get('day-details')
  async getDayDetails(@Query() query: CalendarDayDetailsQueryDto) {
    return this.calendarService.getDayDetails(query);
  }

  @Post('refresh')
  async refreshAffectedDates(@Body() body: CalendarRefreshDto) {
    return this.calendarService.enqueueRefresh(body);
  }
}
