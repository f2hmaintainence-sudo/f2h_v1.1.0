CREATE TABLE packaging_types (
    id VARCHAR(30) PRIMARY KEY,

    name VARCHAR(100) NOT NULL,
    -- 1 L Bottle, 500 ML Bottle, 250 ML Pouch

    capacity NUMERIC(10,2) NOT NULL,

    unit VARCHAR(20) NOT NULL,
    -- LTR / KG / PCS

    is_returnable BOOLEAN DEFAULT false,

    deposit_amount NUMERIC(10,2) DEFAULT 0,

    status VARCHAR(20) DEFAULT 'active',

    created_at TIMESTAMPTZ DEFAULT now()
);