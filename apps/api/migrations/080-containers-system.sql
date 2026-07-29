-- Migration: 080-containers-system.sql
-- Description: Comprehensive Containers & Return Tracking System tables & columns

-- 1. Master Containers Table
CREATE TABLE IF NOT EXISTS containers (
    id BIGSERIAL PRIMARY KEY,
    container_id VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    is_returnable BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add container_id to products and product_variants
ALTER TABLE products ADD COLUMN IF NOT EXISTS container_id VARCHAR(30) DEFAULT NULL;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS container_id VARCHAR(30) DEFAULT NULL;

-- 3. Per-Order Container Tracking Table (for Delivery Boy Fulfillment & Checklist)
CREATE TABLE IF NOT EXISTS order_containers (
    id BIGSERIAL PRIMARY KEY,
    order_id VARCHAR(30) NOT NULL,
    customer_id VARCHAR(30) NOT NULL,
    container_id VARCHAR(30) NOT NULL,
    expected_quantity INTEGER NOT NULL DEFAULT 1,
    returned_quantity INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, returned, broken, missed, lost
    notes TEXT DEFAULT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial default containers if empty
INSERT INTO containers (container_id, name, quantity, is_returnable, status)
VALUES 
    ('CONT-001', 'Glass Bottle 1L', 500, true, 'active'),
    ('CONT-002', 'Plastic Bucket 5L', 200, true, 'active'),
    ('CONT-003', 'Metal Can 10L', 100, true, 'active'),
    ('CONT-004', 'Crate 12L', 150, true, 'active')
ON CONFLICT (container_id) DO NOTHING;
