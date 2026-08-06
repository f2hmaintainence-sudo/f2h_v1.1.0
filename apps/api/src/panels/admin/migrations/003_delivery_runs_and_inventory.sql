-- ═══════════════════════════════════════════════════════════════════
-- Migration 003: Delivery Run Architecture + Inventory Enhancements
-- Compatible with PostgreSQL 12+
-- Run ONCE on your database (after 002_admin_panel_complete.sql)
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ══════════════════════════════════════════════════════════════════
-- PART A: DROP OLD DELIVERY ASSIGNMENT TABLES
-- ══════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS delivery_assignment_history CASCADE;
DROP TABLE IF EXISTS delivery_assignments CASCADE;

-- ══════════════════════════════════════════════════════════════════
-- PART B: DELIVERY RUNS ARCHITECTURE
-- ══════════════════════════════════════════════════════════════════

-- ── 1. delivery_runs ─────────────────────────────────────────────
-- One run per delivery partner / date / slot.
-- Represents a single delivery trip with multiple addresses.
CREATE TABLE IF NOT EXISTS delivery_runs (
  id              SERIAL   PRIMARY KEY,
  run_number      VARCHAR(30)   NOT NULL gen_random_uuid()::varchar(30),
  delivery_partner_id VARCHAR(30) NOT NULL REFERENCES delivery_boys(delivery_boy_id),
  branch_id       VARCHAR       REFERENCES branches(branch_id),
  run_date        DATE          NOT NULL DEFAULT CURRENT_DATE,
  delivery_slot   VARCHAR(30)   NOT NULL DEFAULT 'morning'
    CHECK (delivery_slot IN ('morning','evening')),
  status          VARCHAR(20)   DEFAULT 'planned'
    CHECK (status IN ('planned', 'assigned', 'in_progress', 'completed', 'cancelled', 'partial')),
  assignment_method VARCHAR(30) DEFAULT 'auto_balanced'
    CHECK (assignment_method IN ('auto_history', 'auto_cluster', 'auto_balanced', 'manual')),
  total_addresses   INTEGER     DEFAULT 0,
  completed_addresses INTEGER   DEFAULT 0,
  failed_addresses   INTEGER    DEFAULT 0,
  planned_start_time TIMESTAMPTZ DEFAULT NULL,
  actual_start_time  TIMESTAMPTZ DEFAULT NULL,
  actual_end_time    TIMESTAMPTZ DEFAULT NULL,
  total_distance_km  DECIMAL(8,2) DEFAULT NULL,
  assigned_by     VARCHAR       DEFAULT NULL,
  notes           TEXT          DEFAULT NULL,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_runs_number
  ON delivery_runs (run_number);
CREATE INDEX IF NOT EXISTS idx_delivery_runs_partner_date
  ON delivery_runs (delivery_partner_id, run_date, delivery_slot);
CREATE INDEX IF NOT EXISTS idx_delivery_runs_branch_date
  ON delivery_runs (branch_id, run_date);
CREATE INDEX IF NOT EXISTS idx_delivery_runs_status
  ON delivery_runs (status) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_delivery_runs_date
  ON delivery_runs (run_date DESC);

-- ── 2. delivery_run_addresses ────────────────────────────────────
-- Assigned addresses/orders within a run, with delivery sequence.
CREATE TABLE IF NOT EXISTS delivery_run_addresses (
  id              VARCHAR(30)   PRIMARY KEY DEFAULT gen_random_uuid()::varchar(30),
  run_id          VARCHAR(30)   NOT NULL REFERENCES delivery_runs(id) ON DELETE CASCADE,
  order_id        VARCHAR       NOT NULL,
  address_id      VARCHAR       DEFAULT NULL,
  sequence_number INTEGER       NOT NULL DEFAULT 0,
  status          VARCHAR(20)   DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_transit', 'arrived', 'delivered', 'failed', 'skipped', 'returned')),
  customer_name   VARCHAR(200)  DEFAULT NULL,
  address_line    TEXT          DEFAULT NULL,
  contact_number  VARCHAR(20)   DEFAULT NULL,
  latitude        DECIMAL(10,7) DEFAULT NULL,
  longitude       DECIMAL(10,7) DEFAULT NULL,
  delivery_notes  TEXT          DEFAULT NULL,
  proof_photo_url TEXT          DEFAULT NULL,
  proof_signature_url TEXT      DEFAULT NULL,
  delivered_at    TIMESTAMPTZ   DEFAULT NULL,
  failed_reason   TEXT          DEFAULT NULL,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_run_addresses_run_seq
  ON delivery_run_addresses (run_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_run_addresses_order
  ON delivery_run_addresses (order_id);
CREATE INDEX IF NOT EXISTS idx_run_addresses_status
  ON delivery_run_addresses (status) WHERE status NOT IN ('delivered', 'failed');
CREATE INDEX IF NOT EXISTS idx_run_addresses_run_status
  ON delivery_run_addresses (run_id, status);

-- ── 3. delivery_logs ─────────────────────────────────────────────
-- Immutable event log for all delivery events.
CREATE TABLE IF NOT EXISTS delivery_logs (
  id              VARCHAR(30)   PRIMARY KEY DEFAULT gen_random_uuid()::varchar(30),
  run_id          VARCHAR(30)   REFERENCES delivery_runs(id) ON DELETE SET NULL,
  run_address_id  VARCHAR(30)   REFERENCES delivery_run_addresses(id) ON DELETE SET NULL,
  order_id        VARCHAR       DEFAULT NULL,
  event_type      VARCHAR(40)   NOT NULL
    CHECK (event_type IN (
      'run_created', 'run_assigned', 'run_started', 'run_completed', 'run_cancelled',
      'address_arrived', 'address_delivered', 'address_failed', 'address_skipped', 'address_returned',
      'reassignment', 'status_change', 'proof_uploaded', 'gps_update', 'note_added',
      'partner_checkin', 'partner_checkout'
    )),
  from_status     VARCHAR(30)   DEFAULT NULL,
  to_status       VARCHAR(30)   DEFAULT NULL,
  from_partner_id VARCHAR(30)   DEFAULT NULL REFERENCES delivery_boys(id),
  to_partner_id   VARCHAR(30)   DEFAULT NULL REFERENCES delivery_boys(id),
  latitude        DECIMAL(10,7) DEFAULT NULL,
  longitude       DECIMAL(10,7) DEFAULT NULL,
  proof_url       TEXT          DEFAULT NULL,
  reason          TEXT          DEFAULT NULL,
  metadata        JSONB         DEFAULT '{}'::jsonb,
  performed_by    VARCHAR       DEFAULT NULL,
  created_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_run
  ON delivery_logs (run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_run_address
  ON delivery_logs (run_address_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_event_type
  ON delivery_logs (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_order
  ON delivery_logs (order_id) WHERE order_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════
-- PART C: SCHEMA ALTERATIONS FOR DELIVERY RUNS
-- ══════════════════════════════════════════════════════════════════

-- Orders: link to delivery run
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_run_id VARCHAR(30) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS run_sequence INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_run
  ON orders (delivery_run_id) WHERE delivery_run_id IS NOT NULL;

-- Delivery boys: performance tracking
ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT NULL;
ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS total_runs INTEGER DEFAULT 0;
ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS total_deliveries INTEGER DEFAULT 0;

-- ══════════════════════════════════════════════════════════════════
-- PART D: INVENTORY & WAREHOUSE ENHANCEMENT TABLES
-- ══════════════════════════════════════════════════════════════════

-- ── 4. purchase_entries ──────────────────────────────────────────
-- Records of stock purchased from vendors, received into warehouses.
CREATE TABLE IF NOT EXISTS purchase_entries (
  id                int  PRIMARY KEY ,
  purchase_number   VARCHAR(30)   NOT NULL UNIQUE DEFAULT gen_random_uuid()::varchar(30),
  vendor_id         INTEGER       DEFAULT NULL,
  warehouse_id      INTEGER       DEFAULT NULL,
  variant_id        VARCHAR       NOT NULL,
  product_id        VARCHAR       DEFAULT NULL,
  quantity          INTEGER       NOT NULL CHECK (quantity > 0),
  unit_cost         DECIMAL(10,2) DEFAULT 0,
  total_cost        DECIMAL(12,2) DEFAULT 0,
  batch_number      VARCHAR(50)   DEFAULT NULL,
  manufacturing_date DATE         DEFAULT NULL,
  expiry_date       DATE          DEFAULT NULL,
  received_by       VARCHAR       DEFAULT NULL,
  status            VARCHAR(20)   DEFAULT 'received'
    CHECK (status IN ('pending', 'received', 'inspected', 'rejected', 'returned')),
  quality_notes     TEXT          DEFAULT NULL,
  invoice_number    VARCHAR(50)   DEFAULT NULL,
  invoice_url       TEXT          DEFAULT NULL,
  created_at        TIMESTAMPTZ   DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_entries_vendor
  ON purchase_entries (vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_entries_warehouse
  ON purchase_entries (warehouse_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_entries_variant
  ON purchase_entries (variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_entries_expiry
  ON purchase_entries (expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_entries_batch
  ON purchase_entries (batch_number) WHERE batch_number IS NOT NULL;

-- ── 5. dispatch_plans ────────────────────────────────────────────
-- Plans for dispatching stock from warehouse to branches.
CREATE TABLE IF NOT EXISTS dispatch_plans (
  id                INT   PRIMARY KEY ,
  dispatch_number   VARCHAR(30)   NOT NULL UNIQUE DEFAULT gen_random_uuid()::varchar(30),
  source_warehouse_id INTEGER     DEFAULT NULL,
  target_branch_id  VARCHAR       REFERENCES branches(branch_id),
  dispatch_date     DATE          NOT NULL,
  status            VARCHAR(20)   DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'picking', 'dispatched', 'in_transit', 'received', 'cancelled')),
  total_items       INTEGER       DEFAULT 0,
  total_quantity    INTEGER       DEFAULT 0,
  dispatched_by     VARCHAR       DEFAULT NULL,
  dispatched_at     TIMESTAMPTZ   DEFAULT NULL,
  received_by       VARCHAR       DEFAULT NULL,
  received_at       TIMESTAMPTZ   DEFAULT NULL,
  vehicle_number    VARCHAR(30)   DEFAULT NULL,
  notes             TEXT          DEFAULT NULL,
  created_by        VARCHAR       DEFAULT NULL,
  created_at        TIMESTAMPTZ   DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispatch_plan_items (
  id                INT   PRIMARY KEY,
  dispatch_plan_id  VARCHAR(30)   NOT NULL REFERENCES dispatch_plans(dispatch_number) ON DELETE CASCADE,
  variant_id        VARCHAR       NOT NULL,
  product_id        VARCHAR       DEFAULT NULL,
  required_quantity INTEGER       NOT NULL DEFAULT 0,
  dispatched_quantity INTEGER     DEFAULT 0,
  received_quantity INTEGER       DEFAULT 0,
  unit              VARCHAR(20)   DEFAULT 'pcs',
  notes             TEXT          DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_dispatch_plans_warehouse
  ON dispatch_plans (source_warehouse_id, dispatch_date);
CREATE INDEX IF NOT EXISTS idx_dispatch_plans_branch
  ON dispatch_plans (target_branch_id, dispatch_date);
CREATE INDEX IF NOT EXISTS idx_dispatch_plans_status
  ON dispatch_plans (status) WHERE status NOT IN ('received', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_dispatch_plan_items_plan
  ON dispatch_plan_items (dispatch_plan_id);

-- ── 6. consumption_forecasts ─────────────────────────────────────
-- Daily predicted consumption per variant/branch.
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

-- ══════════════════════════════════════════════════════════════════
-- PART E: ADMIN SYSTEM TABLES (roles, audit)
-- ══════════════════════════════════════════════════════════════════

-- ── 7. admin_roles ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_roles (
  id              INT   PRIMARY KEY,
  role_name       VARCHAR(50)   NOT NULL UNIQUE,
  description     TEXT          DEFAULT NULL,
  permissions     JSONB         DEFAULT '[]'::jsonb,
  is_active       BOOLEAN       DEFAULT TRUE,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- ── 8. admin_audit_logs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id              INT   PRIMARY KEY ,
  admin_id        VARCHAR       NOT NULL,
  admin_name      VARCHAR(200)  DEFAULT NULL,
  action          VARCHAR(50)   NOT NULL,
  target_type   VARCHAR(50)   NOT NULL,
  target_id     VARCHAR       DEFAULT NULL,
  details         JSONB         DEFAULT '{}'::jsonb,
  ip_address      VARCHAR(50)   DEFAULT NULL,
  user_agent      TEXT          DEFAULT NULL,
  created_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin
  ON admin_audit_logs (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON admin_audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
  ON admin_audit_logs (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date
  ON admin_audit_logs (created_at DESC);

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN (
--   'delivery_runs', 'delivery_run_addresses', 'delivery_logs',
--   'purchase_entries', 'dispatch_plans', 'dispatch_plan_items',
--   'consumption_forecasts', 'admin_roles', 'admin_audit_logs'
-- );

COMMIT;
