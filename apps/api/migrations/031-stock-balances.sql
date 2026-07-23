CREATE TABLE stock_balances (
    id BIGSERIAL PRIMARY KEY,

    warehouse_id VARCHAR(30) NOT NULL,

    product_variant_id VARCHAR(30) NOT NULL,

    available_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
    -- Current physical stock

    reserved_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
    -- Reserved for today's dispatch

    dispatched_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
    -- Loaded to delivery vehicles but not yet returned

    damaged_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,

    low_stock_threshold NUMERIC(12,2) DEFAULT 10,

    is_out_of_stock BOOLEAN GENERATED ALWAYS AS (
        available_quantity <= 0
    ) STORED,

    last_stock_update TIMESTAMPTZ DEFAULT now(),

    created_at TIMESTAMPTZ DEFAULT now(),

    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE (warehouse_id, product_variant_id)
);
CREATE INDEX idx_stock_balances
ON warehouse_inventory(warehouse_id);

CREATE INDEX idx_stock_balances
ON warehouse_inventory(product_variant_id);

CREATE INDEX idx_stock_balancesk
ON warehouse_inventory(available_quantity);