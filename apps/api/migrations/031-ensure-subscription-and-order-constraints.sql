-- ============================================================================
-- Migration   : 031-ensure-subscription-and-order-constraints.sql
-- Target      : PostgreSQL (f2h_dev / f2h_fresh)
-- Created At  : 2026-09-25T06:52:00.000Z
--
-- Description : Ensures unique constraints exist on:
--               1. orders (subscription_id, scheduled_date, delivery_slot)
--               2. subscription_custom_schedule (subscription_item_id, delivery_date)
--
-- Backward Compatibility:
--   - Uses IF NOT EXISTS checks on pg_constraint and pg_indexes so it is
--     fully idempotent and safe to apply to existing databases.
-- ============================================================================

DO $$
BEGIN
  -- 1. Ensure uq_subscription_delivery on orders
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conrelid = 'orders'::regclass
    AND    conname  = 'uq_subscription_delivery'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM   pg_indexes
      WHERE  tablename = 'orders'
      AND    indexdef LIKE '%(subscription_id, scheduled_date, delivery_slot)%'
    ) THEN
      ALTER TABLE orders
        ADD CONSTRAINT uq_subscription_delivery
        UNIQUE (subscription_id, scheduled_date, delivery_slot);
      RAISE NOTICE 'Created constraint uq_subscription_delivery on orders';
    END IF;
  ELSE
    RAISE NOTICE 'Constraint uq_subscription_delivery already exists on orders — skipping';
  END IF;

  -- 2. Ensure unique constraint on subscription_custom_schedule
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conrelid = 'subscription_custom_schedule'::regclass
    AND    conname  = 'uq_sub_custom_schedule_item_date'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM   pg_indexes
      WHERE  tablename = 'subscription_custom_schedule'
      AND    indexdef LIKE '%(subscription_item_id, delivery_date)%'
    ) THEN
      ALTER TABLE subscription_custom_schedule
        ADD CONSTRAINT uq_sub_custom_schedule_item_date
        UNIQUE (subscription_item_id, delivery_date);
      RAISE NOTICE 'Created constraint uq_sub_custom_schedule_item_date on subscription_custom_schedule';
    END IF;
  ELSE
    RAISE NOTICE 'Constraint uq_sub_custom_schedule_item_date already exists on subscription_custom_schedule — skipping';
  END IF;
END;
$$;
