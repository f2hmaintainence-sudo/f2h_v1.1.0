-- =========================================================
-- 7. SUBSCRIPTION DAILY SNAPSHOTS
-- FINAL EXECUTION TABLE
-- Used for:
-- orders
-- packing
-- billing
-- delivery
-- =========================================================

CREATE TABLE subscription_daily_snapshots (
    id BIGSERIAL PRIMARY KEY,

    snapshot_date DATE NOT NULL,

    order_id VARCHAR(30) NOT NULL,

    subscription_id VARCHAR(30) NOT NULL,

    subscription_item_id VARCHAR(30) NOT NULL,

    customer_id VARCHAR(30) NOT NULL,

    product_variant_id VARCHAR(30) NOT NULL,

    m_base_qty NUMERIC(10,2) DEFAULT 0,
    e_base_qty NUMERIC(10,2) DEFAULT 0,

    m_override_qty NUMERIC(10,2) DEFAULT 0,
    e_override_qty NUMERIC(10,2) DEFAULT 0,

    m_final_qty NUMERIC(10,2) DEFAULT 0,
    e_final_qty NUMERIC(10,2) DEFAULT 0,

    custom_price NUMERIC(10,2),

    delivery_status subscription_delivery_status_enum
    DEFAULT 'pending',

    billing_status subscription_billing_status_enum
    DEFAULT 'pending',

    generated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(snapshot_date, subscription_item_id)
);

CREATE INDEX idx_snapshots_date
ON subscription_daily_snapshots(snapshot_date);

CREATE INDEX idx_snapshots_customer
ON subscription_daily_snapshots(customer_id);

CREATE INDEX idx_snapshots_delivery
ON subscription_daily_snapshots(delivery_status);

CREATE INDEX idx_snapshots_variant
ON subscription_daily_snapshots(product_variant_id);
