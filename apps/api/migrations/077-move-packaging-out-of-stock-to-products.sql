-- Migration 077: Move packaging_type_id and is_out_of_stock from product_variants to products

-- 1. Add columns to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS packaging_type_id VARCHAR(30) REFERENCES packaging_types(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_out_of_stock BOOLEAN NOT NULL DEFAULT false;

-- 2. Drop columns from product_variants table
ALTER TABLE product_variants
  DROP COLUMN IF EXISTS packaging_type_id,
  DROP COLUMN IF EXISTS is_out_of_stock;
