-- ============================================================================
-- Migration   : 029-add-purchase-price-to-product-variants.sql
-- Target      : PostgreSQL (f2h_dev / f2h_fresh)
-- Created At  : 2026-09-22T16:15:00.000Z
--
-- Description : Adds nullable purchase_price column to product_variants for
--               accurate Cost of Goods Sold (COGS) and profit & loss analytics.
-- ============================================================================

BEGIN;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10,2) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_product_variants_purchase_price
  ON public.product_variants(purchase_price)
  WHERE purchase_price IS NOT NULL;

COMMIT;
