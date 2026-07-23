CREATE TABLE container_transactions (
    id BIGSERIAL PRIMARY KEY,

    customer_id VARCHAR(30) NOT NULL,

    packaging_type_id VARCHAR(30) NOT NULL
    REFERENCES packaging_types(id),

    reference_type VARCHAR(20) NOT NULL,
    -- subscription / order / trial / manual

    reference_id VARCHAR(30),

    transaction_type VARCHAR(20) NOT NULL,
    -- issue / return / damaged / lost / adjustment

    quantity INTEGER NOT NULL,

    remarks TEXT,

    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,

    created_by VARCHAR(30),

    created_at TIMESTAMPTZ DEFAULT now()
);