CREATE TABLE IF NOT EXISTS product_batches (
  id SERIAL PRIMARY KEY,
  warehouse_id varchar(30)  NOT NULL,
  batch_id TEXT NOT NULL UNIQUE,
  product_id varchar(30)  NOT NULL,
  variant_id varchar(30)  DEFAULT NULL,
  manufactured_at DATE,
  expiry_at DATE,
  quantity NUMERIC(18,4) NOT NULL DEFAULT 0,
  available_quantity NUMERIC(18,4) NOT NULL DEFAULT 0,
  damaged_quantity NUMERIC(18,4) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);
