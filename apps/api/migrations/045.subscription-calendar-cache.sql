CREATE TABLE subscription_calendar_cache (
    id BIGSERIAL PRIMARY KEY,

    calendar_date DATE NOT NULL,

    branch_id VARCHAR(30),

    zone_id VARCHAR(30),

    product_variant_id VARCHAR(30),

    total_m_qty NUMERIC(12,2) DEFAULT 0,

    total_e_qty NUMERIC(12,2) DEFAULT 0,

    total_pause_count INTEGER DEFAULT 0,

    total_extra_count INTEGER DEFAULT 0,

    total_custom_count INTEGER DEFAULT 0,

    active_subscription_count INTEGER DEFAULT 0,

    estimated_routes INTEGER DEFAULT 0,

    generated_at TIMESTAMPTZ DEFAULT now()
);