CREATE TABLE delivery_dispatch_items (
    id BIGSERIAL PRIMARY KEY,

    dispatch_id VARCHAR(30) NOT NULL,

    warehouse_id VARCHAR(30) NOT NULL,

    delivery_run_id VARCHAR(30) NOT NULL
    REFERENCES delivery_runs(run_id)
    ON DELETE CASCADE,

    product_variant_id VARCHAR(30) NOT NULL,

    planned_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
    -- From snapshots assigned to run

    loaded_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
    -- Actually loaded into vehicle

    delivered_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
    -- Successfully delivered

    returned_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
    -- Returned to warehouse

    damaged_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
    -- Leakage / damaged packets

    extra_sold_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
    -- Additional sales during route

    unit VARCHAR(20),
    -- LTR / KG / PCS

    remarks TEXT,

    created_at TIMESTAMPTZ DEFAULT now(),

    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(delivery_run_id, product_variant_id)
);

CREATE INDEX idx_dispatch_items_run
ON delivery_dispatch_items(delivery_run_id);

CREATE INDEX idx_dispatch_items_variant
ON delivery_dispatch_items(product_variant_id);