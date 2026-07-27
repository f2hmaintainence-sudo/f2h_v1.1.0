CREATE TABLE delivery_logs (
    id BIGSERIAL PRIMARY KEY,

    run_id VARCHAR(30),

    customer_id VARCHAR(30) NOT NULL,

    order_id VARCHAR(30) NOT NULL,

    address_id VARCHAR(30) NOT NULL,

    delivery_partner_id VARCHAR(30) NOT NULL,

    delivery_date DATE NOT NULL,

    slot VARCHAR(20) NOT NULL,

    items_json JSONB,
    -- delivered items from snapshots
    -- [
    --     {
    --         "product_variant_id": "MILK_STD",
    --         "product_name": "Milk",
    --         "m_qty": 1.5,
    --         "e_qty": 0
    --     },
    --     {
    --         "product_variant_id": "CURD_STD",
    --         "product_name": "Curd",
    --         "m_qty": 1,
    --         "e_qty": 0
    --     }
    -- ]

    photo_id VARCHAR(30),

    bottles_collected INTEGER DEFAULT 0,

    cash_collected NUMERIC(12,2) DEFAULT 0,

    remarks TEXT,

    latitude NUMERIC(10,7),

    longitude NUMERIC(10,7),

    status VARCHAR(20) NOT NULL,
    -- delivered / failed / partial / skipped

    delivered_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_delivery_logs_customer
ON delivery_logs(customer_id);

CREATE INDEX idx_delivery_logs_date
ON delivery_logs(delivery_date);

CREATE INDEX idx_delivery_logs_boy
ON delivery_logs(delivery_partner_id);


