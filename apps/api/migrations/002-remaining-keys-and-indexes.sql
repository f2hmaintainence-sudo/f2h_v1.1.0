-- ============================================================================
-- 003 — Remaining primary keys & hot-path indexes
--
-- Follows 002. Covers the tables that still had no primary key, plus the
-- lookup columns the API filters on most often:
--
--   * subscriptions   — core table, keyed by customer_id/status on every
--                       dashboard, billing run and order-generation pass
--   * carts           — read/written on every cart mutation, keyed by user_id
--   * stock_balances  — (warehouse_id, product_variant_id) is the natural key
--                       and was already assumed unique by upsert code
--   * auth_logs       — "who is online" queries scan this
--
-- Idempotent; safe to re-apply.
-- ============================================================================

BEGIN;

-- ─── Primary keys ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_schema='public' AND table_name='subscriptions'
                   AND constraint_type='PRIMARY KEY') THEN
    ALTER TABLE subscriptions ADD PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_schema='public' AND table_name='stock_balances'
                   AND constraint_type='PRIMARY KEY') THEN
    ALTER TABLE stock_balances ADD PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_schema='public' AND table_name='auth_logs'
                   AND constraint_type='PRIMARY KEY') THEN
    ALTER TABLE auth_logs ADD PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_schema='public' AND table_name='contact_enquiries'
                   AND constraint_type='PRIMARY KEY') THEN
    ALTER TABLE contact_enquiries ADD PRIMARY KEY (id);
  END IF;

  -- carts holds exactly one row per user, so user_id is the natural key.
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_schema='public' AND table_name='carts'
                   AND constraint_type='PRIMARY KEY') THEN
    ALTER TABLE carts ADD PRIMARY KEY (user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_schema='public' AND table_name='cache'
                   AND constraint_type='PRIMARY KEY') THEN
    ALTER TABLE cache ADD PRIMARY KEY (key);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_schema='public' AND table_name='cache_locks'
                   AND constraint_type='PRIMARY KEY') THEN
    ALTER TABLE cache_locks ADD PRIMARY KEY (key);
  END IF;
END $$;

-- ─── Subscriptions ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer
  ON subscriptions (customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON subscriptions (status) WHERE deleted_at IS NULL;
-- Order generation asks "which active subscriptions cover this date?".
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_window
  ON subscriptions (status, start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_branch
  ON subscriptions (branch_id) WHERE deleted_at IS NULL;
-- NOT unique: subscription_number is issued once per *customer* (it lives on
-- customers.subscription_number and is copied onto each of that customer's
-- subscription rows), so several subscriptions legitimately share one number.
-- It is still looked up directly by the admin subscription search.
CREATE INDEX IF NOT EXISTS idx_subscriptions_number
  ON subscriptions (subscription_number) WHERE subscription_number IS NOT NULL;

-- ─── Stock balances ─────────────────────────────────────────────────────────
-- The upsert path already treats this pair as unique; enforce it so concurrent
-- stock writes cannot create duplicate balance rows for the same variant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_balances_warehouse_variant
  ON stock_balances (warehouse_id, product_variant_id);

-- ─── Auth logs ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_login
  ON auth_logs (user_id, login_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_logs_online
  ON auth_logs (is_online, last_activity_at DESC) WHERE deleted_at IS NULL;

-- ─── Misc ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contact_enquiries_status
  ON contact_enquiries (status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cache_expiration ON cache (expiration);

COMMIT;

ANALYZE;
