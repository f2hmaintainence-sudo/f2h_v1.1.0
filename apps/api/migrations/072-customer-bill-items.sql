CREATE TABLE customer_bill_items (
    id BIGSERIAL PRIMARY KEY,

    bill_id VARCHAR(30) NOT NULL
    REFERENCES customer_bills(bill_id)
    ON DELETE CASCADE,

    reference_type VARCHAR(20) NOT NULL,
    -- order
    -- subscription

    reference_id VARCHAR(30) NOT NULL,
    -- order_item_id OR subscription delivery reference

    product_variant_id VARCHAR(30) NOT NULL
    REFERENCES product_variants(variant_id),

    quantity NUMERIC(10,2) NOT NULL,

    unit_price NUMERIC(12,2) NOT NULL,

    discount_amount NUMERIC(12,2) DEFAULT 0,

    tax_amount NUMERIC(12,2) DEFAULT 0,

    total_amount NUMERIC(12,2) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT now()
);