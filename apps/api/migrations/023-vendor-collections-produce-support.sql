-- ============================================================================
-- ChronoSparkSolutions — A Software Company
-- © 2026 ChronoSparkSolutions. All rights reserved.
--
-- Migration   : 023-vendor-collections-produce-support.sql
-- Description : Extend vendor_collections table to support produce, ghee, fruits, & other goods
-- ============================================================================

BEGIN;

ALTER TABLE IF EXISTS public.vendor_collections
    ADD COLUMN IF NOT EXISTS collection_type VARCHAR(30) DEFAULT 'MILK' NOT NULL, -- 'MILK', 'OTHERS'
    ADD COLUMN IF NOT EXISTS batch_lot_no VARCHAR(60),                           -- e.g. 'LOT-20260916-GHEE01'
    ADD COLUMN IF NOT EXISTS packaging_type VARCHAR(60),                         -- e.g. 'Glass Jar', 'Tin', 'Crate', 'Box'
    ADD COLUMN IF NOT EXISTS purity_percentage NUMERIC(5,2),                     -- e.g. 99.50% purity or Brix %
    ADD COLUMN IF NOT EXISTS storage_location VARCHAR(80),                       -- e.g. 'Cold Storage', 'Dry Warehouse'
    ADD COLUMN IF NOT EXISTS harvest_date DATE,
    ADD COLUMN IF NOT EXISTS expiry_date DATE,
    ADD COLUMN IF NOT EXISTS gross_quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS defect_quantity NUMERIC(10,2) DEFAULT 0.00;

-- Index on collection_type for fast partitioning/querying
CREATE INDEX IF NOT EXISTS idx_vendor_collections_type ON public.vendor_collections(collection_type);
CREATE INDEX IF NOT EXISTS idx_vendor_collections_batch ON public.vendor_collections(batch_lot_no);

COMMIT;
