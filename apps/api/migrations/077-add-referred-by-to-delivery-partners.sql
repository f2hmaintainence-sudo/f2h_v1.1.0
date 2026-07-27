ALTER TABLE delivery_partners 
ADD COLUMN IF NOT EXISTS referred_by VARCHAR(50);
