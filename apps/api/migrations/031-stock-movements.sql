CREATE TABLE stock_movements (
    id BIGSERIAL PRIMARY KEY,

    movement_id VARCHAR(100) UNIQUE NOT NULL,

    warehouse_id VARCHAR(30) NOT NULL,

    product_variant_id VARCHAR(30) NOT NULL,

    batch_id VARCHAR(50),

    movement_type VARCHAR(30) NOT NULL
        CHECK (movement_type IN (
            'purchase',
            'production',
            'stock_transfer',
            'dispatch',
            'delivery_return',
            'customer_return',
            'stock_adjustment',
            'damage',
            'expiry',
            'opening_stock',
            'closing_stock'
        )),

    direction SMALLINT NOT NULL
        CHECK (direction IN (-1, 1)),
    -- 1 = Stock In
    -- -1 = Stock Out

    quantity NUMERIC(12,2) NOT NULL,

    quantity_before NUMERIC(12,2) NOT NULL,

    quantity_after NUMERIC(12,2) NOT NULL,

    unit_cost NUMERIC(12,4),

    reference_type VARCHAR(50),
    -- purchase
    -- stock_transfer
    -- dispatch
    -- order
    -- subscription
    -- adjustment
    -- production

    reference_id VARCHAR(100),

    notes TEXT,

    created_by VARCHAR(30),

    updated_by VARCHAR(30),

    created_at TIMESTAMPTZ DEFAULT now(),

    updated_at TIMESTAMPTZ DEFAULT now(),

    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_stock_movements_warehouse
ON stock_movements(warehouse_id);

CREATE INDEX idx_stock_movements_variant
ON stock_movements(product_variant_id);

CREATE INDEX idx_stock_movements_type
ON stock_movements(movement_type);

CREATE INDEX idx_stock_movements_reference
ON stock_movements(reference_type, reference_id);

CREATE INDEX idx_stock_movements_created
ON stock_movements(created_at);