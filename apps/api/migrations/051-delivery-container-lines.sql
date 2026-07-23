CREATE TABLE delivery_container_lines (
    id BIGSERIAL PRIMARY KEY,

    customer_id VARCHAR(30) NOT NULL,

    product_variant_id VARCHAR(30) NOT NULL,

    packaging_type_id VARCHAR(30) NOT NULL
    REFERENCES packaging_types(id),

    quantity INTEGER NOT NULL,
    -- number of bottles/containers

    reference_type VARCHAR(20) NOT NULL,
    -- subscription / order / trial

    reference_id VARCHAR(30) NOT NULL,
    -- subscription_id OR order_id OR trial_id

    delivery_date DATE NOT NULL,

    created_at TIMESTAMPTZ DEFAULT now()
);