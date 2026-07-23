-- Create products table
CREATE TABLE public.products
(
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL,
    sku VARCHAR(100) NOT NULL,

    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,

    category_id VARCHAR(100) NOT NULL,
    vendor_id VARCHAR(100),

    description TEXT,
    highlights TEXT,
    ingredients TEXT,
    legal_info TEXT,

    is_subscribable BOOLEAN NOT NULL DEFAULT false,
    is_one_time BOOLEAN NOT NULL DEFAULT true,
    is_returnable BOOLEAN NOT NULL DEFAULT false,
    batch_product BOOLEAN NOT NULL DEFAULT false,

    unit_type product_unit_enum NOT NULL,
    lift_days INTEGER,

    gst_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
