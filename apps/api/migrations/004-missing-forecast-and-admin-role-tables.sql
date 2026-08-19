-- ============================================================================
-- ChronoSparkSolutions — A Software Company
-- © 2026 ChronoSparkSolutions. All rights reserved.
--
-- Project     : F2H Fresh
-- File        : 004-missing-forecast-and-admin-role-tables.sql
-- Description : Creates two tables the application queries but which were never
--               provisioned, so every call hit
--               'relation "…" does not exist':
--                 • consumption_forecasts — inventory demand forecasting
--                 • admin_roles           — admin role management
--
--               Both are declared in
--               src/panels/admin/migrations/003_delivery_runs_and_inventory.sql,
--               which cannot be replayed as-is: it opens with destructive
--               DROP TABLE … CASCADE statements and ALTERs a `delivery_boys`
--               table this database does not have. The definitions below are
--               lifted from it with one correction — `id` was declared as a
--               bare `INT PRIMARY KEY` with no default, so the INSERTs in
--               inventory-reports.service.ts and admin-system.service.ts (which
--               never supply an id) would fail a not-null violation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.consumption_forecasts (
  id                 INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  variant_id         VARCHAR       NOT NULL,
  branch_id          VARCHAR       REFERENCES public.branches(branch_id),
  forecast_date      DATE          NOT NULL,
  predicted_quantity INTEGER       NOT NULL DEFAULT 0,
  subscription_qty   INTEGER       DEFAULT 0,
  onetime_qty        INTEGER       DEFAULT 0,
  buffer_qty         INTEGER       DEFAULT 0,
  confidence_pct     DECIMAL(5,2)  DEFAULT NULL,
  actual_quantity    INTEGER       DEFAULT NULL,
  computed_at        TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (variant_id, branch_id, forecast_date)
);

CREATE INDEX IF NOT EXISTS idx_consumption_forecast_lookup
  ON public.consumption_forecasts (variant_id, branch_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_consumption_forecast_date
  ON public.consumption_forecasts (forecast_date, branch_id);

CREATE TABLE IF NOT EXISTS public.admin_roles (
  id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_name   VARCHAR(50)  NOT NULL UNIQUE,
  description TEXT         DEFAULT NULL,
  permissions JSONB        DEFAULT '[]'::jsonb,
  is_active   BOOLEAN      DEFAULT TRUE,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);
