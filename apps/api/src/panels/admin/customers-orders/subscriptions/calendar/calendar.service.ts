import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/shared/redis/redis.service';
import {
  CalendarDayDetailsQueryDto,
} from './dto/calendar.dto';
import { CalendarRepository } from './repository/calendar.repository';

@Injectable()
export class CalendarService {
  constructor(
    private readonly repository: CalendarRepository,
    private readonly redis: RedisService,
  ) {}

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

}
