-- Add current_lat and current_lng columns to delivery_partners table
ALTER TABLE delivery_partners 
ADD COLUMN IF NOT EXISTS current_lat numeric(10,7),
ADD COLUMN IF NOT EXISTS current_lng numeric(10,7);
