-- ============================================================================
-- ChronoSparkSolutions — A Software Company
-- © 2026 ChronoSparkSolutions. All rights reserved.
--
-- Migration   : 022-vendor-collections-schema.sql
-- Description : Create vendor_collections table for daily vendor produce & milk procurement
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_collections (
    id SERIAL PRIMARY KEY,
    collection_id VARCHAR(50) NOT NULL UNIQUE,
    collection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift VARCHAR(20) NOT NULL DEFAULT 'MORNING', -- 'MORNING', 'EVENING', 'AFTERNOON', 'GENERAL'
    vendor_id VARCHAR(50) NOT NULL,
    vendor_name VARCHAR(150) NOT NULL,
    collector_name VARCHAR(100) NOT NULL,
    collector_phone VARCHAR(20),
    product_id VARCHAR(50),
    product_name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Dairy & Milk',
    quantity NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    unit VARCHAR(20) NOT NULL DEFAULT 'Liters', -- 'Liters', 'Kg', 'Units', 'Crates'
    rate_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    
    -- Dairy / Milk specific quality parameters
    fat_percentage NUMERIC(4,2), -- e.g., 4.50%
    snf_percentage NUMERIC(4,2), -- e.g., 8.50% (Solids-Not-Fat)
    clr_reading NUMERIC(5,2),    -- e.g., 28.5 (Corrected Lactometer Reading)
    temperature NUMERIC(4,1),    -- e.g., 4.0 °C
    acidity NUMERIC(4,2),        -- e.g., 6.6 pH
    quality_grade VARCHAR(30) DEFAULT 'Grade A', -- 'Grade A', 'Grade B', 'Grade C', 'Premium', 'Standard', 'Rejected'
    container_can_no VARCHAR(50), -- e.g., 'CAN-01', 'CAN-12'
    
    -- Financial & Tracking
    payment_status VARCHAR(30) DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'PARTIAL'
    payment_mode VARCHAR(30) DEFAULT 'CASH',      -- 'CASH', 'UPI', 'BANK_TRANSFER', 'CREDIT'
    payment_reference VARCHAR(100),
    notes TEXT,
    extra_attributes JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(30) DEFAULT 'RECORDED',        -- 'RECORDED', 'VERIFIED', 'REJECTED', 'CANCELLED'
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- Indexes for optimal querying & daily analytics
CREATE INDEX IF NOT EXISTS idx_vendor_collections_collection_id ON public.vendor_collections(collection_id);
CREATE INDEX IF NOT EXISTS idx_vendor_collections_vendor_id ON public.vendor_collections(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_collections_date ON public.vendor_collections(collection_date);
CREATE INDEX IF NOT EXISTS idx_vendor_collections_shift ON public.vendor_collections(shift);
CREATE INDEX IF NOT EXISTS idx_vendor_collections_category ON public.vendor_collections(category);
CREATE INDEX IF NOT EXISTS idx_vendor_collections_status ON public.vendor_collections(status);
CREATE INDEX IF NOT EXISTS idx_vendor_collections_payment_status ON public.vendor_collections(payment_status);
CREATE INDEX IF NOT EXISTS idx_vendor_collections_collector ON public.vendor_collections(collector_name);

COMMIT;
