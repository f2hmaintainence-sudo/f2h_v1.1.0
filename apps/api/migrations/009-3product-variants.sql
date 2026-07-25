CREATE TABLE product_variants
(
    id SERIAL PRIMARY KEY,

    variant_id VARCHAR(100) NOT NULL UNIQUE,

    product_id  VARCHAR(100) NOT NULL,

    name VARCHAR(200) NOT NULL,

    sku VARCHAR(100),

    price NUMERIC(10,2) NOT NULL,

    subscription_price NUMERIC(10,2),

    unit_value NUMERIC(10,3),

    unit_type product_unit_enum,

    fulfillment_mode fulfillment_mode_enum NOT NULL DEFAULT 'prepacked',

    status VARCHAR(20) NOT NULL DEFAULT 'active',

    manageable_qty INTEGER NOT NULL DEFAULT 0,

    sort_order INTEGER NOT NULL DEFAULT 0,

    created_by VARCHAR(100),

    updated_by VARCHAR(100),

    deleted_at TIMESTAMPTZ DEFAULT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);




    
