-- Migration: 021-vendors-schema.sql
-- Description: Create vendors table for supplier registration and public showcase
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendors (
    id SERIAL PRIMARY KEY,
    vendor_id VARCHAR(50) NOT NULL UNIQUE,
    business_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(120),
    category VARCHAR(100) NOT NULL,
    description TEXT,
    address TEXT,
    city VARCHAR(80) NOT NULL DEFAULT 'Bengaluru',
    state VARCHAR(80) NOT NULL DEFAULT 'Karnataka',
    pincode VARCHAR(10),
    gstin VARCHAR(30),
    fssai_license VARCHAR(30),
    supply_capacity VARCHAR(100),
    experience_years VARCHAR(50) DEFAULT '1-2 Years',
    rating NUMERIC(3,2) DEFAULT 4.85,
    total_products_supplied INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    status VARCHAR(30) DEFAULT 'approved',
    image_url TEXT,
    logo_url TEXT,
    website_url TEXT,
    source VARCHAR(50) DEFAULT 'website',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- Indexes for fast querying & filtering
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_id ON public.vendors(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON public.vendors(category);
CREATE INDEX IF NOT EXISTS idx_vendors_city ON public.vendors(city);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON public.vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_phone ON public.vendors(phone);
CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON public.vendors(is_active);

COMMIT;

