-- Add packaging_type_id column to product_variants table
ALTER TABLE product_variants
ADD COLUMN packaging_type_id VARCHAR(30) REFERENCES packaging_types(id) DEFAULT NULL;
