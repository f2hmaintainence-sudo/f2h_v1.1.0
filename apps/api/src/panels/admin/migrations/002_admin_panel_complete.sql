-- ═══════════════════════════════════════════════════════════════════
-- Migration 002: Admin Panel Complete Schema
-- Compatible with PostgreSQL 12+
-- F2H uses Branches + Branch Radius ONLY (no Zones, no Routes)
-- Run ONCE on your database
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Delivery Assignments ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_assignments (
  id                VARCHAR(30)        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          VARCHAR      NOT NULL,
  delivery_boy_id   VARCHAR(30)        NOT NULL REFERENCES delivery_boys(id),
  branch_id         VARCHAR      REFERENCES branches(branch_id),
  assignment_method  VARCHAR(30)  DEFAULT 'auto'
    CHECK (assignment_method IN ('auto_history', 'auto_cluster', 'auto_balanced', 'manual')),
  assigned_at       TIMESTAMPTZ  DEFAULT NOW(),
  assigned_by       VARCHAR      DEFAULT NULL,
  status            VARCHAR(20)  DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'reassigned')),
  completed_at      TIMESTAMPTZ  DEFAULT NULL,
  notes             TEXT         DEFAULT NULL,
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order
  ON delivery_assignments (order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_partner_date
  ON delivery_assignments (delivery_boy_id, assigned_at::date);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_branch_date
  ON delivery_assignments (branch_id, assigned_at::date);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_status
  ON delivery_assignments (status) WHERE status NOT IN ('delivered', 'failed');

-- ── 2. Delivery Assignment History (reassignment audit) ──────────
CREATE TABLE IF NOT EXISTS delivery_assignment_history (
  id                  VARCHAR(30)        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id       VARCHAR(30)        NOT NULL REFERENCES delivery_assignments(id),
  from_partner_id     VARCHAR(30)        REFERENCES delivery_boys(id),
  to_partner_id       VARCHAR(30)        NOT NULL REFERENCES delivery_boys(id),
  reason              TEXT         DEFAULT NULL,
  reassigned_by       VARCHAR      DEFAULT NULL,
  created_at          TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_history_assignment
  ON delivery_assignment_history (assignment_id);

-- ── 3. Inventory Transactions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id                VARCHAR(30)       PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id        VARCHAR      NOT NULL,
  warehouse_id      VARCHAR      DEFAULT NULL,
  branch_id         VARCHAR      REFERENCES branches(branch_id),
  transaction_type  VARCHAR(20)  NOT NULL
    CHECK (transaction_type IN ('stock_in', 'stock_out', 'adjustment', 'dispatch', 'return', 'damage')),
  quantity          INTEGER      NOT NULL,
  reference_type    VARCHAR(30)  DEFAULT NULL,
  reference_id      VARCHAR      DEFAULT NULL,
  notes             TEXT         DEFAULT NULL,
  created_by        VARCHAR      DEFAULT NULL,
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_txn_variant
  ON inventory_transactions (product_variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_warehouse
  ON inventory_transactions (warehouse_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_branch
  ON inventory_transactions (branch_id, created_at DESC);

-- ── 4. Inventory Alerts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_alerts (
  id                VARCHAR(30)       PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id        VARCHAR      NOT NULL,
  branch_id         VARCHAR      REFERENCES branches(branch_id),
  alert_type        VARCHAR(20)  NOT NULL
    CHECK (alert_type IN ('low_stock', 'out_of_stock', 'expiry_soon', 'overstock')),
  current_stock     INTEGER      DEFAULT 0,
  threshold         INTEGER      DEFAULT 0,
  is_resolved       BOOLEAN      DEFAULT FALSE,
  resolved_at       TIMESTAMPTZ  DEFAULT NULL,
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_unresolved
  ON inventory_alerts (is_resolved, alert_type) WHERE is_resolved = FALSE;

-- ── 5. Refunds ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refunds (
  id                VARCHAR(30)        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          VARCHAR      NOT NULL,
  customer_id       VARCHAR      NOT NULL,
  amount            DECIMAL(10,2) NOT NULL,
  reason            TEXT         DEFAULT NULL,
  refund_method     VARCHAR(20)  DEFAULT 'wallet'
    CHECK (refund_method IN ('wallet', 'original_payment', 'bank_transfer')),
  status            VARCHAR(20)  DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'processed', 'rejected')),
  processed_by      VARCHAR      DEFAULT NULL,
  processed_at      TIMESTAMPTZ  DEFAULT NULL,
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_customer
  ON refunds (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_status
  ON refunds (status) WHERE status IN ('pending', 'approved');

-- ── 6. Company Profile ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_profile (
  id                VARCHAR(30)        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(200) NOT NULL DEFAULT 'F2H Fresh',
  legal_name        VARCHAR(200) DEFAULT NULL,
  gst_number        VARCHAR(20)  DEFAULT NULL,
  pan_number        VARCHAR(15)  DEFAULT NULL,
  email             VARCHAR(150) DEFAULT NULL,
  phone             VARCHAR(20)  DEFAULT NULL,
  address           TEXT         DEFAULT NULL,
  city              VARCHAR(100) DEFAULT NULL,
  state             VARCHAR(100) DEFAULT NULL,
  pincode           VARCHAR(10)  DEFAULT NULL,
  logo_url          TEXT         DEFAULT NULL,
  website           VARCHAR(200) DEFAULT NULL,
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- ── 7. Notification Settings ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_settings (
  id                VARCHAR(30)       PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key       VARCHAR(100) NOT NULL UNIQUE,
  setting_value     JSONB        DEFAULT '{}'::jsonb,
  description       TEXT         DEFAULT NULL,
  is_active         BOOLEAN      DEFAULT TRUE,
  updated_by        VARCHAR      DEFAULT NULL,
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- ── 8. Orders table enhancements ─────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_partner_id VARCHAR(30) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assignment_method VARCHAR(30) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner
  ON orders (delivery_partner_id) WHERE delivery_partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_status
  ON orders (scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_orders_branch_date
  ON orders (branch_id, scheduled_date);

-- ── 9. Delivery Boys enhancements ────────────────────────────────
ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS current_lat DECIMAL(10,7) DEFAULT NULL;
ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS current_lng DECIMAL(10,7) DEFAULT NULL;
ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS max_daily_orders INTEGER DEFAULT 50;
ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMPTZ DEFAULT NULL;

-- ── 10. Branches radius configuration ────────────────────────────
ALTER TABLE branches ADD COLUMN IF NOT EXISTS radius_km DECIMAL(5,2) DEFAULT 5.00;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS center_lat DECIMAL(10,7) DEFAULT NULL;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS center_lng DECIMAL(10,7) DEFAULT NULL;

-- ── 11. Financial Reports Cache ──────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_reports_cache (
  id                VARCHAR(30)        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type       VARCHAR(50)  NOT NULL,
  report_date       DATE         NOT NULL,
  branch_id         VARCHAR      REFERENCES branches(branch_id),
  data              JSONB        NOT NULL DEFAULT '{}'::jsonb,
  computed_at       TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (report_type, report_date, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_cache_lookup
  ON financial_reports_cache (report_type, report_date);

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN (
--   'delivery_assignments','delivery_assignment_history',
--   'inventory_transactions','inventory_alerts','refunds',
--   'company_profile','notification_settings','financial_reports_cache'
-- );
