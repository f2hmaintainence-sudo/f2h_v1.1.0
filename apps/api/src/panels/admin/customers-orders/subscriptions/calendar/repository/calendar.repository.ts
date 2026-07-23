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

  async findMonth(query: MonthlyCalendarQueryDto) {
    const { startDate, endDate } = this.resolveMonthRange(query.month);
    const params: any[] = [startDate, endDate, DEFAULT_ROUTE_CAPACITY];
    const where: string[] = ['calendar_date >= $1', 'calendar_date <= $2'];

    this.pushOptional(where, params, 'branch_id', query.branch_id);
    this.pushOptional(where, params, 'zone_id', query.zone_id);
    this.pushOptional(where, params, 'product_variant_id', query.product_variant_id);
    this.pushProductFilter(where, params, query.product);

    const rows = await this.db.query(
      `
      SELECT
        calendar_date::text,
        branch_id,
        zone_id,
        product_variant_id,
        SUM(total_m_qty)::numeric(12,2)::text AS total_m_qty,
        SUM(total_e_qty)::numeric(12,2)::text AS total_e_qty,
        (SUM(total_m_qty) + SUM(total_e_qty))::numeric(12,2)::text AS total_daily_qty,
        SUM(total_pause_count)::int AS total_pause_count,
        SUM(total_extra_count)::int AS total_extra_count,
        SUM(total_custom_count)::int AS total_custom_count,
        SUM(active_subscription_count)::int AS active_subscription_count,
        SUM(estimated_routes)::int AS estimated_routes,
        $3::numeric AS route_capacity,
        ((SUM(total_m_qty) + SUM(total_e_qty)) > (NULLIF(SUM(estimated_routes), 0) * $3::numeric)) AS capacity_warning,
        MAX(generated_at)::text AS generated_at
      FROM subscription_calendar_cache
      JOIN product_variants pv
        ON pv.variant_id = subscription_calendar_cache.product_variant_id
      JOIN products p
        ON p.product_id = pv.product_id
        OR p.id::text = pv.product_id
      WHERE ${where.join(' AND ')}
        AND p.is_subscribable = true
        AND p.deleted_at IS NULL
      GROUP BY calendar_date, branch_id, zone_id, product_variant_id
      ORDER BY calendar_date ASC
      `,
      params,
    );

    return rows;
  }

  async findDayDetails(query: CalendarDayDetailsQueryDto) {
    const params: any[] = [query.date, DEFAULT_ROUTE_CAPACITY];
    const baseWhere: string[] = ['scc.calendar_date = $1'];
    this.pushOptional(baseWhere, params, 'scc.branch_id', query.branch_id);
    this.pushOptional(baseWhere, params, 'scc.zone_id', query.zone_id);
    this.pushOptional(baseWhere, params, 'scc.product_variant_id', query.product_variant_id);
    this.pushProductFilter(baseWhere, params, query.product, 'p');

    const productQuantities = await this.db.query(
      `
      SELECT
        scc.product_variant_id,
        SUM(scc.total_m_qty)::numeric(12,2)::text AS morning_qty,
        SUM(scc.total_e_qty)::numeric(12,2)::text AS evening_qty,
        (SUM(scc.total_m_qty) + SUM(scc.total_e_qty))::numeric(12,2)::text AS total_qty,
        SUM(scc.active_subscription_count)::int AS active_subscription_count,
        SUM(scc.total_pause_count)::int AS paused_count,
        SUM(scc.total_extra_count)::int AS extra_count,
        SUM(scc.total_custom_count)::int AS custom_count,
        SUM(scc.estimated_routes)::int AS estimated_routes,
        ((SUM(scc.total_m_qty) + SUM(scc.total_e_qty)) > (NULLIF(SUM(scc.estimated_routes), 0) * $2::numeric)) AS capacity_warning
      FROM subscription_calendar_cache scc
      JOIN product_variants pv
        ON pv.variant_id = scc.product_variant_id
      JOIN products p
        ON p.product_id = pv.product_id
        OR p.id::text = pv.product_id
      WHERE ${baseWhere.join(' AND ')}
        AND p.is_subscribable = true
        AND p.deleted_at IS NULL
      GROUP BY scc.product_variant_id
      ORDER BY scc.product_variant_id
      `,
      params,
    );

    const detailParams: any[] = [query.date];
    const detailWhere: string[] = ['sub.status <> $2'];
    detailParams.push('cancelled');
    this.pushOptional(detailWhere, detailParams, 'c.zone_id', query.zone_id);
    this.pushOptional(detailWhere, detailParams, 'si.product_variant_id', query.product_variant_id);
    this.pushProductFilter(detailWhere, detailParams, query.product, 'p');
    if (query.customer_id) {
      detailParams.push(query.customer_id);
      detailWhere.push(`sub.customer_id = $${detailParams.length}`);
    }

    const overrides = await this.db.query(
      `
      SELECT
        so.id,
        so.subscription_item_id,
        sub.customer_id,
        si.product_variant_id,
        so.override_type,
        so.m_quantity::text,
        so.e_quantity::text,
        so.is_paid,
        so.notes
      FROM subscription_overrides so
      JOIN subscription_items si ON si.id = so.subscription_item_id
      JOIN subscriptions sub ON sub.subscription_id = si.subscription_id
      JOIN product_variants pv ON pv.variant_id = si.product_variant_id
      JOIN products p ON p.product_id = pv.product_id OR p.id::text = pv.product_id
      LEFT JOIN customers c ON c.customer_id = sub.customer_id
      WHERE so.override_date = $1 AND ${detailWhere.join(' AND ')}
        AND p.is_subscribable = true
        AND p.deleted_at IS NULL
      ORDER BY so.id DESC
      LIMIT 200
      `,
      detailParams,
    );

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
      source: 'subscription_calendar_cache',
      product_quantities: productQuantities,
      overrides,
      pauses,
      custom_dates: customDates,
      route_estimations: productQuantities.map((row: any) => ({
        product_variant_id: row.product_variant_id,
        estimated_routes: row.estimated_routes,
        capacity_warning: row.capacity_warning,
      })),
      customer_count,
    };
  }

  async rebuildRange(startDate: string, endDate: string) {
    await this.db.query(
      `
      WITH calendar_days AS (
        SELECT gs::date AS calendar_date
        FROM generate_series($1::date, $2::date, interval '1 day') gs
      ),
      base_items AS (
        SELECT
          d.calendar_date,
          sub.subscription_id AS subscription_id,
          sub.customer_id,
          COALESCE(c.zone_id, 'ALL') AS zone_id,
          'ALL'::varchar(30) AS branch_id,
          si.id AS subscription_item_id,
          si.product_variant_id,
          sub.schedule_type
        FROM calendar_days d
        JOIN subscriptions sub
          ON sub.status = 'active'
         AND sub.start_date <= d.calendar_date
         AND COALESCE(sub.end_date, d.calendar_date) >= d.calendar_date
        JOIN subscription_items si
          ON si.subscription_id = sub.subscription_id
         AND si.status = 'active'
         AND COALESCE(si.start_date, sub.start_date) <= d.calendar_date
         AND COALESCE(si.end_date, d.calendar_date) >= d.calendar_date
        JOIN product_variants pv
          ON pv.variant_id = si.product_variant_id
        JOIN products p
          ON (p.product_id = pv.product_id OR p.id::text = pv.product_id)
         AND p.is_subscribable = true
         AND p.deleted_at IS NULL
        LEFT JOIN customers c ON c.customer_id = sub.customer_id
      ),
      planned AS (
        SELECT
          bi.calendar_date,
          bi.branch_id,
          bi.zone_id,
          bi.product_variant_id,
          bi.subscription_id,
          bi.subscription_item_id,
          COALESCE(cd.m_quantity, ws.m_quantity, 0) AS m_quantity,
          COALESCE(cd.e_quantity, ws.e_quantity, 0) AS e_quantity,
          (cd.id IS NOT NULL)::int AS custom_count
        FROM base_items bi
        LEFT JOIN subscription_custom_schedule cd
          ON cd.subscription_item_id = bi.subscription_item_id
         AND cd.delivery_date = bi.calendar_date
        LEFT JOIN subscription_weekly_schedule ws
          ON ws.subscription_item_id = bi.subscription_item_id
         AND ws.day_of_week = EXTRACT(DOW FROM bi.calendar_date)::int
         AND COALESCE(ws.effective_from, bi.calendar_date) <= bi.calendar_date
         AND COALESCE(ws.effective_to, bi.calendar_date) >= bi.calendar_date
        WHERE cd.id IS NOT NULL OR ws.id IS NOT NULL
      ),
      adjusted AS (
        SELECT
          p.calendar_date,
          p.branch_id,
          p.zone_id,
          p.product_variant_id,
          p.subscription_id,
          p.subscription_item_id,
          CASE
            WHEN pause.id IS NOT NULL THEN 0
            WHEN ov.id IS NOT NULL THEN ov.m_quantity
            ELSE p.m_quantity
          END AS final_m_quantity,
          CASE
            WHEN pause.id IS NOT NULL THEN 0
            WHEN ov.id IS NOT NULL THEN ov.e_quantity
            ELSE p.e_quantity
          END AS final_e_quantity,
          (pause.id IS NOT NULL)::int AS pause_count,
          (ov.id IS NOT NULL AND ov.override_type IN ('extra', 'EX'))::int AS extra_count,
          p.custom_count
        FROM planned p
        LEFT JOIN subscription_overrides ov
          ON ov.subscription_item_id = p.subscription_item_id
         AND ov.override_date = p.calendar_date
        LEFT JOIN subscription_pauses pause
          ON pause.subscription_item_id = p.subscription_item_id
         AND p.calendar_date BETWEEN pause.start_date AND pause.end_date
      ),
      aggregate_rows AS (
        SELECT
          calendar_date,
          branch_id,
          zone_id,
          product_variant_id,
          SUM(final_m_quantity)::numeric(12,2) AS total_m_qty,
          SUM(final_e_quantity)::numeric(12,2) AS total_e_qty,
          SUM(pause_count)::int AS total_pause_count,
          SUM(extra_count)::int AS total_extra_count,
          SUM(custom_count)::int AS total_custom_count,
          COUNT(DISTINCT subscription_id)::int AS active_subscription_count,
          CEIL((SUM(final_m_quantity + final_e_quantity) / $3::numeric))::int AS estimated_routes
        FROM adjusted
        GROUP BY calendar_date, branch_id, zone_id, product_variant_id
      )
      INSERT INTO subscription_calendar_cache (
        calendar_date,
        branch_id,
        zone_id,
        product_variant_id,
        total_m_qty,
        total_e_qty,
        total_pause_count,
        total_extra_count,
        total_custom_count,
        active_subscription_count,
        estimated_routes,
        generated_at
      )
      SELECT
        calendar_date,
        branch_id,
        zone_id,
        product_variant_id,
        total_m_qty,
        total_e_qty,
        total_pause_count,
        total_extra_count,
        total_custom_count,
        active_subscription_count,
        estimated_routes,
        now()
      FROM aggregate_rows
      ON CONFLICT (calendar_date, branch_id, zone_id, product_variant_id)
      DO UPDATE SET
        total_m_qty = EXCLUDED.total_m_qty,
        total_e_qty = EXCLUDED.total_e_qty,
        total_pause_count = EXCLUDED.total_pause_count,
        total_extra_count = EXCLUDED.total_extra_count,
        total_custom_count = EXCLUDED.total_custom_count,
        active_subscription_count = EXCLUDED.active_subscription_count,
        estimated_routes = EXCLUDED.estimated_routes,
        generated_at = now()
      `,
      [startDate, endDate, DEFAULT_ROUTE_CAPACITY],
    );
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
