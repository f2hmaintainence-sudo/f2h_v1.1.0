-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 005: Subscription Refund Candidates & Payouts
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose:
--   Replaces the old `subscription_refunds` (monthly-aggregate, pause-only)
--   table with two new, per-delivery-level tables:
--
--   1. subscription_refund_candidates
--      One row per refundable subscription delivery slot.
--      Sources: cron pause, order failure, order cancellation, skipped delivery.
--
--   2. subscription_refund_payouts
--      One row per admin-approved batch credit to a customer wallet.
--      Many candidates → one payout per customer per approval action.
--
-- Run: psql -d <db> -f 005_subscription_refund_candidates.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. subscription_refund_candidates ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_refund_candidates (
  refund_candidate_id   VARCHAR(36)    PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id       VARCHAR        NOT NULL,
  subscription_item_id  VARCHAR        NOT NULL,
  customer_id           VARCHAR        NOT NULL,
  order_id              VARCHAR        DEFAULT NULL,     -- NULL for paused/skipped days
  scheduled_date        DATE           NOT NULL,
  delivery_slot         VARCHAR(10)    NOT NULL
    CHECK (delivery_slot IN ('morning', 'evening')),
  quantity              NUMERIC(10,2)  NOT NULL DEFAULT 1,
  unit_price            NUMERIC(10,2)  NOT NULL DEFAULT 0,
  final_price           NUMERIC(10,2)  NOT NULL DEFAULT 0,
  refund_amount         NUMERIC(10,2)  NOT NULL DEFAULT 0,  -- quantity × final_price
  refund_reason         VARCHAR(30)    NOT NULL
    CHECK (refund_reason IN ('pause', 'failed', 'cancelled', 'skipped', 'stock_out')),
  source                VARCHAR(15)    NOT NULL DEFAULT 'pause'
    CHECK (source IN ('order', 'pause')),
  status                VARCHAR(15)    NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'refunded', 'rejected')),
  refund_payout_id      VARCHAR(36)    DEFAULT NULL, -- FK to subscription_refund_payouts
  approved_by           VARCHAR        DEFAULT NULL,
  approved_at           TIMESTAMPTZ    DEFAULT NULL,
  notes                 TEXT           DEFAULT NULL,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ    DEFAULT NULL,

  -- Prevents duplicate refund candidate for the same item/date/slot
  CONSTRAINT uq_refund_candidate
    UNIQUE (subscription_item_id, scheduled_date, delivery_slot)
);

CREATE INDEX IF NOT EXISTS idx_src_pending
  ON subscription_refund_candidates (status, customer_id)
  WHERE status = 'pending' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_src_subscription
  ON subscription_refund_candidates (subscription_id);

CREATE INDEX IF NOT EXISTS idx_src_scheduled
  ON subscription_refund_candidates (scheduled_date);

CREATE INDEX IF NOT EXISTS idx_src_customer
  ON subscription_refund_candidates (customer_id, created_at DESC);

-- ── 2. subscription_refund_payouts ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_refund_payouts (
  refund_payout_id      VARCHAR(36)    PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number         VARCHAR(30)    UNIQUE NOT NULL,
  customer_id           VARCHAR        NOT NULL,
  total_amount          NUMERIC(10,2)  NOT NULL DEFAULT 0,
  total_deliveries      INT            NOT NULL DEFAULT 0,
  status                VARCHAR(15)    NOT NULL DEFAULT 'approved'
    CHECK (status IN ('approved', 'processed', 'failed')),
  approved_by           VARCHAR        NOT NULL,
  approved_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  processed_at          TIMESTAMPTZ    DEFAULT NULL,
  wallet_transaction_id VARCHAR        DEFAULT NULL,
  notes                 TEXT           DEFAULT NULL,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_srp_customer
  ON subscription_refund_payouts (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_srp_status
  ON subscription_refund_payouts (status)
  WHERE status IN ('approved');

-- ── 3. Migrate existing subscription_refunds data ────────────────────────────
-- Maps old monthly-aggregate rows to per-delivery candidates (best-effort).
-- existing rows won't have per-item granularity so we store them as 'pause'
-- source candidates with aggregate refund amount.

INSERT INTO subscription_refund_candidates (
  subscription_id,
  subscription_item_id,
  customer_id,
  scheduled_date,
  delivery_slot,
  quantity,
  unit_price,
  final_price,
  refund_amount,
  refund_reason,
  source,
  status,
  notes,
  created_at,
  updated_at
)
SELECT
  sr.subscription_id,
  sr.subscription_id,  -- no item-level granularity in the old table
  sr.customer_id,
  -- Use refund_date if available, else first day of refund_month
  COALESCE(sr.refund_date, (sr.refund_month || '-01')::DATE),
  'morning',  -- default slot for migrated rows
  COALESCE(sr.total_paused_days, 1),
  0,
  ROUND(COALESCE(sr.refund_amount, 0) / GREATEST(COALESCE(sr.total_paused_days, 1), 1), 2),
  COALESCE(sr.refund_amount, 0),
  'pause',
  'pause',
  CASE WHEN sr.status = 'processed' THEN 'refunded' ELSE 'pending' END,
  'Migrated from legacy subscription_refunds (monthly aggregate)',
  COALESCE(sr.created_at, NOW()),
  COALESCE(sr.created_at, NOW())
FROM subscription_refunds sr
ON CONFLICT (subscription_item_id, scheduled_date, delivery_slot) DO NOTHING;

-- ── 4. Rename old table (keep for rollback safety, do not DROP immediately) ──
-- Run this line only after verifying the migration above:
-- ALTER TABLE subscription_refunds RENAME TO _subscription_refunds_deprecated;
