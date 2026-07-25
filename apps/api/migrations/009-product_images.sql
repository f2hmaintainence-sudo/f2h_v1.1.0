CREATE TABLE product_images (
    id                SERIAL PRIMARY KEY,
    product_id        VARCHAR(50),
    variant_id        VARCHAR(50),
    url               TEXT,
    storage_key       TEXT,
    alt_text          VARCHAR(255),
    width             INTEGER,
    height            INTEGER,
    sort_order        INTEGER,
    is_primary        BOOLEAN DEFAULT FALSE,
    created_by        VARCHAR(50),
    updated_by        VARCHAR(50),
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_product_images_product_id
    ON product_images(product_id);

CREATE INDEX idx_product_images_variant_id
    ON product_images(variant_id);

CREATE INDEX idx_product_images_primary
    ON product_images(is_primary);

CREATE INDEX idx_product_images_deleted_at
    ON product_images(deleted_at);