export class MonthlyCalendarQueryDto {
  branch_id?: string;
  zone_id?: string;
  product_variant_id?: string;
  product?: string;
  month!: string;
  customer_id?: string;
  active_only?: string;
  include_paused?: string;
  start_date?: string;
  end_date?: string;
}

export class CalendarDayDetailsQueryDto {
  date!: string;
  branch_id?: string;
  zone_id?: string;
  product_variant_id?: string;
  product?: string;
  customer_id?: string;
}

export class CalendarRefreshDto {
  dates?: string[];
  subscription_item_id?: string;
  subscription_id?: string;
  start_date?: string;
  end_date?: string;
  reason?: 'override' | 'pause' | 'schedule' | 'custom_date' | 'manual';
}
