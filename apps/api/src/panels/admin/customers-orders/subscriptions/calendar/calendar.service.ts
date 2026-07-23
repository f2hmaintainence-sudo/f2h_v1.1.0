import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisService } from 'src/shared/redis/redis.service';
import {
  CalendarDayDetailsQueryDto,
  CalendarRefreshDto,
  MonthlyCalendarQueryDto,
} from './dto/calendar.dto';
import { CalendarRepository } from './repository/calendar.repository';

@Injectable()
export class CalendarService {
  constructor(
    private readonly repository: CalendarRepository,
    private readonly redis: RedisService,
    @InjectQueue('calendar-refresh-queue') private readonly refreshQueue: Queue,
  ) {}

  async getMonthlyCalendar(query: MonthlyCalendarQueryDto) {
    const month = query.month || new Date().toISOString().slice(0, 7);
    const cacheKey = [
      'sub_calendar',
      query.branch_id || 'all',
      query.zone_id || 'all',
      query.product_variant_id || query.product || 'all',
      month,
      query.customer_id || 'all',
    ].join(':');

    const cached = await this.redis.fetch(cacheKey);
    if (cached) return cached;

    const days = await this.repository.findMonth({ ...query, month });
    const totals = days.reduce(
      (acc: any, day: any) => {
        acc.total_m_qty += Number(day.total_m_qty || 0);
        acc.total_e_qty += Number(day.total_e_qty || 0);
        acc.total_daily_qty += Number(day.total_daily_qty || 0);
        acc.paused_count += Number(day.total_pause_count || 0);
        acc.extra_count += Number(day.total_extra_count || 0);
        acc.custom_count += Number(day.total_custom_count || 0);
        acc.active_subscription_count += Number(day.active_subscription_count || 0);
        acc.estimated_routes += Number(day.estimated_routes || 0);
        acc.capacity_warning_count += day.capacity_warning ? 1 : 0;
        return acc;
      },
      {
        total_m_qty: 0,
        total_e_qty: 0,
        total_daily_qty: 0,
        paused_count: 0,
        extra_count: 0,
        custom_count: 0,
        active_subscription_count: 0,
        estimated_routes: 0,
        capacity_warning_count: 0,
      },
    );

    const response = { month, source: 'subscription_calendar_cache', days, totals };
    await this.redis.put(cacheKey, response, 300);
    return response;
  }

  async getDayDetails(query: CalendarDayDetailsQueryDto) {
    const cacheKey = [
      'sub_calendar_day',
      query.branch_id || 'all',
      query.zone_id || 'all',
      query.product_variant_id || query.product || 'all',
      query.date,
      query.customer_id || 'all',
    ].join(':');

    const cached = await this.redis.fetch(cacheKey);
    if (cached) return cached;

    const response = await this.repository.findDayDetails(query);
    await this.redis.put(cacheKey, response, 180);
    return response;
  }

  async rebuildRange(startDate: string, endDate: string) {
    await this.repository.rebuildRange(startDate, endDate);
    await this.redis.clearPattern('sub_calendar:*');
    await this.redis.clearPattern('sub_calendar_day:*');
    return { status: true, start_date: startDate, end_date: endDate };
  }

  async enqueueRefresh(body: CalendarRefreshDto) {
    await this.refreshQueue.add('refresh-affected-dates', body, {
      removeOnComplete: 100,
      removeOnFail: 500,
    });
    return { status: true, queued: true };
  }
}
