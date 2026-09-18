-- ============================================================================
-- Migration   : 028-backfill-universal-customers.sql
-- Target      : PostgreSQL (f2h_dev / f2h_fresh)
-- Created At  : 2026-09-18T11:20:26.919Z
--
-- PURPOSE:
-- Enforces universal customer provisioning. Backfills customer records for all
-- existing users (including delivery partners and management staff) who do not
-- currently have a corresponding satellite row in the customers table.
-- ============================================================================

BEGIN;

-- 1. Backfill missing customer records for all existing users
INSERT INTO customers (customer_id, wallet_balance, customer_type, first_order_completed, created_at, updated_at)
SELECT u.user_id, 0.00, 'retail', false, COALESCE(u.created_at, NOW()), COALESCE(u.updated_at, NOW())
FROM users u
LEFT JOIN customers c ON c.customer_id = u.user_id
WHERE c.customer_id IS NULL AND u.user_id IS NOT NULL
ON CONFLICT (customer_id) DO NOTHING;

-- 2. Link default branch for newly backfilled delivery partners & management staff
UPDATE customers c
SET branch_id = dp.branch_id
FROM delivery_partners dp
WHERE c.customer_id = dp.delivery_partner_id
  AND c.branch_id IS NULL
  AND dp.branch_id IS NOT NULL;

UPDATE customers c
SET branch_id = ms.branch_id
FROM management_staff ms
WHERE c.customer_id = ms.user_id
  AND c.branch_id IS NULL
  AND ms.branch_id IS NOT NULL;

COMMIT;
