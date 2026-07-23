import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class CalendarSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CalendarSchedulerService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectQueue('calendar-aggregation-queue') private readonly aggregationQueue: Queue,
  ) {}

  onModuleInit() {
    this.scheduleNextRun();
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  private scheduleNextRun() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(23, 45, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);

    this.timer = setTimeout(async () => {
      await this.aggregationQueue.add(
        'nightly-next-30-days',
        {},
        { removeOnComplete: 30, removeOnFail: 100 },
      );
      this.logger.log('Queued nightly subscription planning calendar aggregation');
      this.scheduleNextRun();
    }, next.getTime() - now.getTime());
  }
}
