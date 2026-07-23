import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CalendarService } from '../calendar.service';
import { CalendarRefreshDto } from '../dto/calendar.dto';

@Processor('calendar-refresh-queue')
export class CalendarRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(CalendarRefreshProcessor.name);

  constructor(private readonly calendarService: CalendarService) {
    super();
  }

  async process(job: Job<CalendarRefreshDto>) {
    const dates = job.data.dates?.filter(Boolean);
    const startDate = job.data.start_date || dates?.sort()[0] || new Date().toISOString().slice(0, 10);
    const endDate = job.data.end_date || dates?.sort().at(-1) || startDate;
    this.logger.log(`Refreshing affected subscription calendar dates ${startDate} to ${endDate}`);
    return this.calendarService.rebuildRange(startDate, endDate);
  }
}
