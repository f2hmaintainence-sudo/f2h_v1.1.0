-- ============================================================================
-- Migration   : 024-vendor-collections-phone-support.sql
-- Target      : PostgreSQL (f2h_dev / f2h_fresh)
-- Created At  : 2026-09-16T12:04:46.951Z
--
-- GUIDELINES FOR SAFE DATABASE VERSION CONTROLLING:
-- 1. BACKWARD COMPATIBILITY: Existing production user data must remain valid.
-- 2. EXPAND-AND-CONTRACT:
--    - When ADDING fields: Column MUST be NULLABLE or have a sensible DEFAULT.
--    - When RENAMING fields: Add new column, backfill data, deprecate old.
--    - When DELETING fields: DO NOT drop immediately; mark deprecated first.
-- 3. IDEMPOTENCY: Use 'IF NOT EXISTS' / 'IF EXISTS' wherever possible.
-- ============================================================================

BEGIN;

-- 1. Schema Changes (Expand)
ALTER TABLE IF EXISTS public.vendor_collections
    ADD COLUMN IF NOT EXISTS vendor_phone VARCHAR(20);

-- 2. Data Migration / Backfill from vendors table
UPDATE public.vendor_collections c
SET vendor_phone = v.phone
FROM public.vendors v
WHERE c.vendor_id = v.vendor_id
  AND c.vendor_phone IS NULL;

-- 3. Constraints & Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_collections_phone ON public.vendor_collections(vendor_phone);

COMMIT;
