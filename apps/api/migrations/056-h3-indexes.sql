-- ═══════════════════════════════════════════════════════════════
-- H3 Spatial Indexing for Delivery Routing
-- Resolution 8: ~0.74km² per hexagon (city-level)
-- Resolution 9: ~0.09km² per hexagon (neighborhood-level)
-- ═══════════════════════════════════════════════════════════════

-- Add H3 index columns to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS h3_index_res8 VARCHAR(20),
ADD COLUMN IF NOT EXISTS h3_index_res9 VARCHAR(20);

-- Add H3 index columns to delivery_partners table for real-time rider tracking
ALTER TABLE delivery_partners 
ADD COLUMN IF NOT EXISTS h3_index_res8 VARCHAR(20),
ADD COLUMN IF NOT EXISTS h3_index_res9 VARCHAR(20);

-- Add H3 index columns to orders table for spatial order clustering
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS pickup_h3_res8 VARCHAR(20),
ADD COLUMN IF NOT EXISTS pickup_h3_res9 VARCHAR(20),
ADD COLUMN IF NOT EXISTS delivery_h3_res8 VARCHAR(20),
ADD COLUMN IF NOT EXISTS delivery_h3_res9 VARCHAR(20);

-- Create indexes on H3 columns for fast spatial queries
CREATE INDEX IF NOT EXISTS idx_customers_h3_res8 ON customers(h3_index_res8);
CREATE INDEX IF NOT EXISTS idx_customers_h3_res9 ON customers(h3_index_res9);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_h3_res8 ON delivery_partners(h3_index_res8);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_h3_res9 ON delivery_partners(h3_index_res9);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_h3_res8 ON orders(pickup_h3_res8);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_h3_res9 ON orders(pickup_h3_res9);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_h3_res8 ON orders(delivery_h3_res8);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_h3_res9 ON orders(delivery_h3_res9);

-- Create composite index for branch + H3 cell queries
CREATE INDEX IF NOT EXISTS idx_customers_branch_h8 ON customers(branch_id, h3_index_res8);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_branch_h8 ON delivery_partners(branch_id, h3_index_res8);
CREATE INDEX IF NOT EXISTS idx_orders_branch_h8 ON orders(branch_id, delivery_h3_res8);

-- Create function to update H3 indexes for customers
CREATE OR REPLACE FUNCTION update_customer_h3_indexes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.address_lat IS NOT NULL AND NEW.address_lng IS NOT NULL THEN
    -- Resolution 8 (city-level, ~0.74km²)
    NEW.h3_index_res8 := h3_latlng_to_cell(NEW.address_lat, NEW.address_lng, 8);
    -- Resolution 9 (neighborhood-level, ~0.09km²)
    NEW.h3_index_res9 := h3_latlng_to_cell(NEW.address_lat, NEW.address_lng, 9);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update H3 indexes for customers
DROP TRIGGER IF EXISTS trigger_update_customer_h3 ON customers;
CREATE TRIGGER trigger_update_customer_h3
BEFORE INSERT OR UPDATE OF address_lat, address_lng ON customers
FOR EACH ROW EXECUTE FUNCTION update_customer_h3_indexes();

-- Create function to update H3 indexes for delivery_partners
CREATE OR REPLACE FUNCTION update_delivery_partner_h3_indexes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_lat IS NOT NULL AND NEW.current_lng IS NOT NULL THEN
    NEW.h3_index_res8 := h3_latlng_to_cell(NEW.current_lat, NEW.current_lng, 8);
    NEW.h3_index_res9 := h3_latlng_to_cell(NEW.current_lat, NEW.current_lng, 9);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update H3 indexes for delivery_partners
DROP TRIGGER IF EXISTS trigger_update_delivery_partner_h3 ON delivery_partners;
CREATE TRIGGER trigger_update_delivery_partner_h3
BEFORE INSERT OR UPDATE OF current_lat, current_lng ON delivery_partners
FOR EACH ROW EXECUTE FUNCTION update_delivery_partner_h3_indexes();

-- Create function to update H3 indexes for orders
CREATE OR REPLACE FUNCTION update_order_h3_indexes()
RETURNS TRIGGER AS $$
DECLARE
  pickup_lat NUMERIC;
  pickup_lng NUMERIC;
  delivery_lat NUMERIC;
  delivery_lng NUMERIC;
BEGIN
  -- Get pickup location (branch or vendor location)
  SELECT b.branch_lat, b.branch_lng INTO pickup_lat, pickup_lng
  FROM branches b
  WHERE b.branch_id = NEW.branch_id;
  
  -- Get delivery location (customer address)
  SELECT c.address_lat, c.address_lng INTO delivery_lat, delivery_lng
  FROM customers c
  WHERE c.id = NEW.customer_id;
  
  -- Update pickup H3 indexes
  IF pickup_lat IS NOT NULL AND pickup_lng IS NOT NULL THEN
    NEW.pickup_h3_res8 := h3_latlng_to_cell(pickup_lat, pickup_lng, 8);
    NEW.pickup_h3_res9 := h3_latlng_to_cell(pickup_lat, pickup_lng, 9);
  END IF;
  
  -- Update delivery H3 indexes
  IF delivery_lat IS NOT NULL AND delivery_lng IS NOT NULL THEN
    NEW.delivery_h3_res8 := h3_latlng_to_cell(delivery_lat, delivery_lng, 8);
    NEW.delivery_h3_res9 := h3_latlng_to_cell(delivery_lat, delivery_lng, 9);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update H3 indexes for orders
DROP TRIGGER IF EXISTS trigger_update_order_h3 ON orders;
CREATE TRIGGER trigger_update_order_h3
BEFORE INSERT OR UPDATE OF branch_id, customer_id ON orders
FOR EACH ROW EXECUTE FUNCTION update_order_h3_indexes();

-- Backfill existing data with H3 indexes
UPDATE customers 
SET 
  h3_index_res8 = h3_latlng_to_cell(address_lat, address_lng, 8),
  h3_index_res9 = h3_latlng_to_cell(address_lat, address_lng, 9)
WHERE address_lat IS NOT NULL AND address_lng IS NOT NULL
  AND (h3_index_res8 IS NULL OR h3_index_res9 IS NULL);

UPDATE delivery_partners 
SET 
  h3_index_res8 = h3_latlng_to_cell(current_lat, current_lng, 8),
  h3_index_res9 = h3_latlng_to_cell(current_lat, current_lng, 9)
WHERE current_lat IS NOT NULL AND current_lng IS NOT NULL
  AND (h3_index_res8 IS NULL OR h3_index_res9 IS NULL);

-- Create table for H3 cell statistics (for analytics and hotspot detection)
CREATE TABLE IF NOT EXISTS h3_cell_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  h3_index VARCHAR(20) NOT NULL,
  resolution INT NOT NULL,
  branch_id VARCHAR(30),
  date DATE NOT NULL,
  hour INT,
  order_count INT DEFAULT 0,
  rider_count INT DEFAULT 0,
  avg_delivery_time INT, -- in minutes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(h3_index, resolution, branch_id, date, hour)
);

CREATE INDEX IF NOT EXISTS idx_h3_stats_h3 ON h3_cell_stats(h3_index);
CREATE INDEX IF NOT EXISTS idx_h3_stats_branch_date ON h3_cell_stats(branch_id, date);
CREATE INDEX IF NOT EXISTS idx_h3_stats_resolution ON h3_cell_stats(resolution);

-- Create table for H3-based rider assignments (cache for Redis)
CREATE TABLE IF NOT EXISTS h3_rider_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  h3_index VARCHAR(20) NOT NULL,
  resolution INT NOT NULL,
  rider_id VARCHAR(50) NOT NULL,
  branch_id VARCHAR(30) NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_h3_assignments_h3 ON h3_rider_assignments(h3_index, is_active);
CREATE INDEX IF NOT EXISTS idx_h3_assignments_rider ON h3_rider_assignments(rider_id, is_active);
CREATE INDEX IF NOT EXISTS idx_h3_assignments_expires ON h3_rider_assignments(expires_at) WHERE is_active = TRUE;

-- Comment for documentation
COMMENT ON TABLE h3_cell_stats IS 'Statistics for H3 cells: order volume, rider availability, delivery times';
COMMENT ON TABLE h3_rider_assignments IS 'Cached rider assignments by H3 cell for fast lookup';
