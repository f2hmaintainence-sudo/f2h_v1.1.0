CREATE TABLE stock_transfers (
    id BIGSERIAL PRIMARY KEY,

    transfer_id VARCHAR(100) UNIQUE NOT NULL,

    from_warehouse_id VARCHAR(30) NOT NULL,

    to_warehouse_id VARCHAR(30) NOT NULL,

    product_variant_id VARCHAR(30) NOT NULL,

    batch_id VARCHAR(50),

    uom VARCHAR(20) NOT NULL,

    quantity NUMERIC(12,2) NOT NULL,

    quantity_dispatched NUMERIC(12,2) DEFAULT 0,

    quantity_received NUMERIC(12,2) DEFAULT 0,

    transfer_type VARCHAR(30)
        CHECK (transfer_type IN (
            'warehouse_transfer',
            'branch_transfer',
            'stock_return',
            'vendor_return',
            'adjustment'
        )),

    reason_code VARCHAR(50),

    transfer_status VARCHAR(30) DEFAULT 'pending'
        CHECK (transfer_status IN (
            'pending',
            'approved',
            'dispatched',
            'partially_received',
            'completed',
            'cancelled'
        )),

    notes TEXT,

    created_by VARCHAR(30),

    updated_by VARCHAR(30),

    approved_by VARCHAR(30),

    dispatched_by VARCHAR(30),

    received_by VARCHAR(30),

    expected_at TIMESTAMPTZ,

    dispatched_at TIMESTAMPTZ,

    received_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now(),

    updated_at TIMESTAMPTZ DEFAULT now(),

    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_stock_transfer_from
ON stock_transfers(from_warehouse_id);

CREATE INDEX idx_stock_transfer_to
ON stock_transfers(to_warehouse_id);

CREATE INDEX idx_stock_transfer_variant
ON stock_transfers(product_variant_id);

CREATE INDEX idx_stock_transfer_status
ON stock_transfers(transfer_status);

CREATE INDEX idx_stock_transfer_created
ON stock_transfers(created_at);