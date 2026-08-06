-- ═══════════════════════════════════════════════════════════════════
-- Phase 1A Migration: Zone & Route Management Schema Updates
-- Compatible with PostgreSQL 12+
-- Run ONCE on your database
-- ═══════════════════════════════════════════════════════════════════

-- ── customers table additions ────────────────────────────────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_lat     DECIMAL(10,7)  DEFAULT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_lng     DECIMAL(10,7)  DEFAULT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_hex     VARCHAR(20)    DEFAULT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sector_index    INTEGER        DEFAULT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS area            VARCHAR(100)   DEFAULT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS apartment_name  VARCHAR(150)   DEFAULT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_notes  TEXT           DEFAULT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS full_name       VARCHAR(200)   GENERATED ALWAYS AS (
  COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')
) STORED;

-- NOTE: If full_name column already exists, comment out the generated column line above
-- and run: UPDATE customers SET full_name = first_name || ' ' || last_name;

-- ── branch_sectors unique constraint (safe) ───────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_branch_sectors'
  ) THEN
    ALTER TABLE branch_sectors ADD CONSTRAINT uq_branch_sectors UNIQUE (branch_id, sector_index);
  END IF;
END $$;

-- ── delivery_route_customers: unique constraint (safe) ────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_route_customer'
  ) THEN
    ALTER TABLE delivery_route_customers ADD CONSTRAINT uq_route_customer UNIQUE (route_id, customer_id);
  END IF;
END $$;

-- ── Phase 4: route_daily_overrides table ─────────────────────────
CREATE TABLE IF NOT EXISTS route_daily_overrides (
  route_id                  UUID          NOT NULL REFERENCES delivery_routes(id),
  override_date             DATE          NOT NULL,
  assigned_delivery_boy_id  UUID          NOT NULL REFERENCES delivery_boys(id),
  reason                    TEXT          DEFAULT NULL,
  created_by                CHARACTER VARYING DEFAULT NULL,
  created_at                TIMESTAMPTZ   DEFAULT NOW(),
  PRIMARY KEY (route_id, override_date)
);

-- ── Phase 5: delivery_boy_locations table (real-time GPS) ────────
CREATE TABLE IF NOT EXISTS delivery_boy_locations (
  delivery_boy_id UUID           NOT NULL REFERENCES delivery_boys(id),
  lat             DECIMAL(10, 7) NOT NULL,
  lng             DECIMAL(10, 7) NOT NULL,
  recorded_at     TIMESTAMPTZ    DEFAULT NOW(),
  shift_type      VARCHAR(10)    DEFAULT 'morning',
  PRIMARY KEY (delivery_boy_id)
);

-- ── Phase 6: delivery status columns on subscriptions ────────────
-- (order_schedule doesn't exist; delivery tracking goes on subscription_daily_snapshots or new table)
CREATE TABLE IF NOT EXISTS delivery_proof_logs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id VARCHAR      NOT NULL REFERENCES subscriptions(id),
  customer_id     CHARACTER VARYING NOT NULL,
  delivery_date   DATE         NOT NULL,
  shift_type      VARCHAR(10)  DEFAULT 'morning',
  delivery_status VARCHAR(20)  DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'delivered', 'not_home', 'issue')),
  proof_photo_url TEXT         DEFAULT NULL,
  delivered_at    TIMESTAMPTZ  DEFAULT NULL,
  delivery_boy_lat DECIMAL(10,7) DEFAULT NULL,
  delivery_boy_lng DECIMAL(10,7) DEFAULT NULL,
  delivery_notes  TEXT         DEFAULT NULL,
  route_id        UUID         REFERENCES delivery_routes(id),
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (subscription_id, delivery_date, shift_type)
);

-- ── Phase 1.5: customer_waitlist table ───────────────────────────
CREATE TABLE IF NOT EXISTS customer_waitlist (
  id           UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        VARCHAR(15)         NOT NULL,
  full_name    VARCHAR(200),
  address_lat  DECIMAL(10,7),
  address_lng  DECIMAL(10,7),
  pincode      VARCHAR(10),
  requested_at TIMESTAMPTZ         DEFAULT NOW(),
  branch_id    CHARACTER VARYING   REFERENCES branches(branch_id)
);

-- ── Performance indexes ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customers_branch_sector_route
  ON customers (branch_id, sector_index, route_id);

CREATE INDEX IF NOT EXISTS idx_customers_address_hex
  ON customers (address_hex);

CREATE INDEX IF NOT EXISTS idx_delivery_boy_locations_recorded
  ON delivery_boy_locations (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_waitlist_branch_pincode
  ON customer_waitlist (branch_id, pincode);

CREATE INDEX IF NOT EXISTS idx_delivery_proof_customer_date
  ON delivery_proof_logs (customer_id, delivery_date);

-- ════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ════════════════════════════════════════════════════════════════════
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'customers' AND column_name IN ('address_lat','address_lng','address_hex','sector_index','apartment_name','delivery_notes');
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('route_daily_overrides','delivery_boy_locations','customer_waitlist','delivery_proof_logs');
