import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/shared/database/Database.service';
import {
  CalendarDayDetailsQueryDto,
  MonthlyCalendarQueryDto,
} from '../dto/calendar.dto';

const DEFAULT_ROUTE_CAPACITY = 120;

@Injectable()
export class CalendarRepository {
  constructor(private readonly db: DatabaseService) {}

  async findDayDetails(query: CalendarDayDetailsQueryDto) {
    const params: any[] = [query.date, DEFAULT_ROUTE_CAPACITY];
    const baseWhere: string[] = ['scc.calendar_date = $1'];
    this.pushOptional(baseWhere, params, 'scc.branch_id', query.branch_id);
    this.pushOptional(baseWhere, params, 'scc.zone_id', query.zone_id);
    this.pushOptional(baseWhere, params, 'scc.product_variant_id', query.product_variant_id);
    this.pushProductFilter(baseWhere, params, query.product, 'p');

    const detailParams: any[] = [query.date];
    const detailWhere: string[] = ['sub.status <> $2'];
    detailParams.push('cancelled');
    if (query.zone_id) {
      detailParams.push(query.zone_id);
      detailWhere.push(`$${detailParams.length} = $${detailParams.length}`);
    }
    this.pushOptional(detailWhere, detailParams, 'si.product_variant_id', query.product_variant_id);
    this.pushProductFilter(detailWhere, detailParams, query.product, 'p');
    if (query.customer_id) {
      detailParams.push(query.customer_id);
      detailWhere.push(`sub.customer_id = $${detailParams.length}`);
    }

    const pauses = await this.db.query(
      `
      SELECT
        sp.id,
        sp.subscription_item_id,
        sp.subscription_id,
        sub.customer_id,
        si.product_variant_id,
        sp.start_date::text,
        sp.end_date::text,
        sp.reason
      FROM subscription_pauses sp
      JOIN subscription_items si ON si.id = sp.subscription_item_id
      JOIN subscriptions sub ON sub.subscription_id = sp.subscription_id
      JOIN product_variants pv ON pv.variant_id = si.product_variant_id
      JOIN products p ON p.product_id = pv.product_id OR p.id::text = pv.product_id
      LEFT JOIN customers c ON c.customer_id = sub.customer_id
      WHERE $1::date BETWEEN sp.start_date AND sp.end_date AND ${detailWhere.join(' AND ')}
        AND p.is_subscribable = true
        AND p.deleted_at IS NULL
      ORDER BY sp.id DESC
      LIMIT 200
      `,
      detailParams,
    );

    const customDates = await this.db.query(
      `
      SELECT
        scd.id,
        scd.subscription_item_id,
        sub.customer_id,
        si.product_variant_id,
        scd.delivery_date::text,
        scd.m_quantity::text,
        scd.e_quantity::text
      FROM subscription_custom_schedule scd
      JOIN subscription_items si ON si.id = scd.subscription_item_id
      JOIN subscriptions sub ON sub.subscription_id = si.subscription_id
      JOIN product_variants pv ON pv.variant_id = si.product_variant_id
      JOIN products p ON p.product_id = pv.product_id OR p.id::text = pv.product_id
      LEFT JOIN customers c ON c.customer_id = sub.customer_id
      WHERE scd.delivery_date = $1 AND ${detailWhere.join(' AND ')}
        AND p.is_subscribable = true
        AND p.deleted_at IS NULL
      ORDER BY scd.id DESC
      LIMIT 200
      `,
      detailParams,
    );

    const [{ customer_count = 0 } = { customer_count: 0 }] = await this.db.query(
      `
      SELECT COUNT(DISTINCT sub.customer_id)::int AS customer_count
      FROM subscriptions sub
      JOIN subscription_items si ON si.subscription_id = sub.subscription_id
      JOIN product_variants pv ON pv.variant_id = si.product_variant_id
      JOIN products p ON p.product_id = pv.product_id OR p.id::text = pv.product_id
      LEFT JOIN customers c ON c.customer_id = sub.customer_id
      WHERE sub.start_date <= $1::date
        AND COALESCE(sub.end_date, $1::date) >= $1::date
        AND si.status = 'active'
        AND ${detailWhere.join(' AND ')}
        AND p.is_subscribable = true
        AND p.deleted_at IS NULL
      `,
      detailParams,
    );

    return {
      date: query.date,
      source: 'live',
      pauses,
      custom_dates: customDates,
      customer_count,
    };
  }

  resolveMonthRange(month: string) {
    const safeMonth = /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
    const start = new Date(`${safeMonth}-01T00:00:00.000Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }

  private pushOptional(where: string[], params: any[], column: string, value?: string) {
    if (!value || value === 'all') return;
    params.push(value);
    where.push(`${column} = $${params.length}`);
  }

  private pushProductFilter(
    where: string[],
    params: any[],
    product?: string,
    alias = 'p',
  ) {
    if (!product || product === 'all') return;
    params.push(product.toLowerCase());
    where.push(
      `(LOWER(${alias}.slug) = $${params.length} OR LOWER(${alias}.name) = $${params.length})`,
    );
  }
}
