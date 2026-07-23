CREATE TABLE IF NOT EXISTS purchase_entries (
  id                int  PRIMARY KEY ,
  purchase_number   VARCHAR(30)   NOT NULL UNIQUE ,
  vendor_id         INTEGER       DEFAULT NULL,
  warehouse_id      INTEGER       DEFAULT NULL,
  variant_id        VARCHAR       NOT NULL,
  product_id        VARCHAR       DEFAULT NULL,
  quantity          INTEGER       NOT NULL CHECK (quantity > 0),
  unit_cost         DECIMAL(10,2) DEFAULT 0,
  total_cost        DECIMAL(12,2) DEFAULT 0,
  batch_number      VARCHAR(50)   DEFAULT NULL,
  manufacturing_date DATE         DEFAULT NULL,
  expiry_date       DATE          DEFAULT NULL,
  received_by       VARCHAR       DEFAULT NULL,
  status            VARCHAR(20)   DEFAULT 'received'
    CHECK (status IN ('pending', 'received', 'inspected', 'rejected', 'returned')),
  quality_notes     TEXT          DEFAULT NULL,
  invoice_number    VARCHAR(50)   DEFAULT NULL,
  invoice_url       TEXT          DEFAULT NULL,
  created_at        TIMESTAMPTZ   DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_entries_vendor
  ON purchase_entries (vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_entries_warehouse
  ON purchase_entries (warehouse_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_entries_variant
  ON purchase_entries (variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_entries_expiry
  ON purchase_entries (expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_entries_batch
  ON purchase_entries (batch_number) WHERE batch_number IS NOT NULL;