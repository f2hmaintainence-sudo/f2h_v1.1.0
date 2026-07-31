-- Migration: Add missing profile fields to delivery_partners table
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(150);
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS emergency_contact_number VARCHAR(20);
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS residential_address TEXT;
