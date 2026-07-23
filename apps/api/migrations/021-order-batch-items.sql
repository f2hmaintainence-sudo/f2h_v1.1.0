-- order_batch_items: variant-level breakdown for each order_batch
-- Groups production/preparation quantities by product variant within a batch

CREATE TABLE IF NOT EXISTS order_batch_items (
    id BIGSERIAL PRIMARY KEY,

    batch_id VARCHAR(30) NOT NULL
        REFERENCES order_batches(batch_id) ON DELETE CASCADE,

    variant_id VARCHAR(100) NOT NULL,

    product_id VARCHAR(100),

    required_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,

    prepared_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,

    unit VARCHAR(20) DEFAULT 'pcs',

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (batch_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_order_batch_items_batch
    ON order_batch_items (batch_id);

CREATE INDEX IF NOT EXISTS idx_order_batch_items_variant
    ON order_batch_items (variant_id);
