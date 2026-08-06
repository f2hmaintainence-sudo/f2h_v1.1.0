import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CalendarService } from '../calendar.service';

@Processor('calendar-aggregation-queue')
export class CalendarAggregationProcessor extends WorkerHost {
  private readonly logger = new Logger(CalendarAggregationProcessor.name);

  constructor(private readonly calendarService: CalendarService) {
    super();
  }

  async process(job: Job<{ start_date?: string; end_date?: string }>) {
    const startDate = job.data.start_date || new Date().toISOString().slice(0, 10);
    const end = new Date(`${startDate}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 30);
    const endDate = job.data.end_date || end.toISOString().slice(0, 10);
    this.logger.log(`Rebuilding subscription calendar cache ${startDate} to ${endDate}`);
    return this.calendarService.rebuildRange(startDate, endDate);
  }
}
