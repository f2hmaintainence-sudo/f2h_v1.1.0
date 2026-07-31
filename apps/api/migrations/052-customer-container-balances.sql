CREATE TABLE customer_container_balances (
    id BIGSERIAL PRIMARY KEY,

    customer_id VARCHAR(30) NOT NULL,

    container_id VARCHAR(30) NOT NULL,

    issued_quantity INTEGER DEFAULT 0,

    returned_quantity INTEGER DEFAULT 0,

    damaged_quantity INTEGER DEFAULT 0,

    lost_quantity INTEGER DEFAULT 0,

    balance_quantity INTEGER GENERATED ALWAYS AS (
        issued_quantity
        - returned_quantity
        - damaged_quantity
        - lost_quantity
    ) STORED,

    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(customer_id, packaging_type_id)
);