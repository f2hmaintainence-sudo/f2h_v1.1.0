CREATE INDEX IF NOT EXISTS idx_subscription_calendar_cache_lookup
ON subscription_calendar_cache(calendar_date, branch_id, zone_id, product_variant_id);

CREATE INDEX IF NOT EXISTS idx_subscription_calendar_cache_month
ON subscription_calendar_cache(date_trunc('month', calendar_date), branch_id, zone_id, product_variant_id);

CREATE INDEX IF NOT EXISTS idx_subscription_pauses_item_dates
ON subscription_pauses(subscription_item_id, start_date, end_date);

CREATE OR REPLACE VIEW subscription_item_pauses AS
SELECT
  id,
  subscription_id,
  subscription_item_id,
  start_date,
  end_date,
  reason,
  created_at
FROM subscription_pauses;
