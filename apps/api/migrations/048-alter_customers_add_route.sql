ALTER TABLE customers ADD COLUMN IF NOT EXISTS route_id UUID;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS apartment_name VARCHAR(200);
CREATE INDEX IF NOT EXISTS idx_customers_route ON customers(route_id);
CREATE INDEX IF NOT EXISTS idx_customers_apartment ON customers(apartment_name);
