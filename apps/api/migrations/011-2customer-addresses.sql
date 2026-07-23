CREATE TABLE customer_addresses (
    id BIGSERIAL PRIMARY KEY,

    customer_id VARCHAR(30) NOT NULL
    REFERENCES customers(customer_id)
    ON DELETE CASCADE,

    address_type VARCHAR(20) DEFAULT 'home',
    -- home / office / other

    contact_name VARCHAR(150),

    contact_mobile VARCHAR(20),

    flat_no VARCHAR(50),

    floor_no VARCHAR(50),

    building_name VARCHAR(150),

    landmark VARCHAR(255),

    street VARCHAR(255),

    area VARCHAR(150),

    city VARCHAR(100),

    state VARCHAR(100),

    pincode VARCHAR(20),

    latitude NUMERIC(10,7),

    longitude NUMERIC(10,7),

    h3_index  VARCHAR(150),

    delivery_note TEXT,

    is_default BOOLEAN DEFAULT f,

    satus BOOLEAN DEFAULT f,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customer_addresses_customer
ON customer_addresses(customer_id);