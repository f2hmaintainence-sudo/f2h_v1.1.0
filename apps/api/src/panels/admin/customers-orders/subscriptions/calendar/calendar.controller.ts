import { Roles, ROLE } from 'src/auth/decorators/roles.decorator';
import { Controller, Get, Query } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarDayDetailsQueryDto } from './dto/calendar.dto';

@Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
@Controller({ path: 'admin/subscriptions/calendar', version: '1' })
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) { }

  @Get('day-details')
  async getDayDetails(@Query() query: CalendarDayDetailsQueryDto) {
    return this.calendarService.getDayDetails(query);
  }
}
