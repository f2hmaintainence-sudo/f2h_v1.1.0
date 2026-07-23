-- =========================================================
-- 2. SUBSCRIPTION ITEMS
-- Multiple products under one subscription
-- =========================================================

CREATE TABLE subscription_items (
    id VARCHAR(30) PRIMARY KEY,

    subscription_item_id VARCHAR(30) NOT NULL,
    
    subscription_id VARCHAR(30) NOT NULL
    REFERENCES subscriptions(subscription_id)
    ON DELETE CASCADE,

    product_variant_id VARCHAR(30) NOT NULL,


    unit_price NUMERIC(10,2) NOT NULL,

    discount_id VARCHAR(30),

    coupon_id VARCHAR(30),

    discount_amount NUMERIC(10,2) DEFAULT 0,

    coupon_amount NUMERIC(10,2) DEFAULT 0,

    final_price NUMERIC(10,2)
    GENERATED ALWAYS AS (
        GREATEST(
            unit_price
            - discount_amount
            - coupon_amount,
            0
        )
    ) STORED,

    is_free BOOLEAN NOT NULL DEFAULT false,

    status subscription_status_enum DEFAULT 'active',

    start_date DATE,
    
    end_date DATE,

    created_at TIMESTAMPTZ DEFAULT now(),

    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subscription_items_sub
ON subscription_items(subscription_id);

CREATE INDEX idx_subscription_items_variant
ON subscription_items(product_variant_id);
