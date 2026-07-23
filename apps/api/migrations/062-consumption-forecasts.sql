CREATE TABLE IF NOT EXISTS consumption_forecasts (
  id                INT   PRIMARY KEY,
  variant_id        VARCHAR       NOT NULL,
  branch_id         VARCHAR       REFERENCES branches(branch_id),
  forecast_date     DATE          NOT NULL,
  predicted_quantity INTEGER      NOT NULL DEFAULT 0,
  subscription_qty  INTEGER       DEFAULT 0,
  onetime_qty       INTEGER       DEFAULT 0,
  buffer_qty        INTEGER       DEFAULT 0,
  confidence_pct    DECIMAL(5,2)  DEFAULT NULL,
  actual_quantity    INTEGER       DEFAULT NULL,
  computed_at       TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (variant_id, branch_id, forecast_date)
);

CREATE INDEX IF NOT EXISTS idx_consumption_forecast_lookup
  ON consumption_forecasts (variant_id, branch_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_consumption_forecast_date
  ON consumption_forecasts (forecast_date, branch_id);