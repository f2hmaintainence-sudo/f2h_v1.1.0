-- =========================================================
-- 4. SUBSCRIPTION CUSTOM DATES
-- Exact delivery dates
-- Used only when schedule_type = custom_dates
-- =========================================================

CREATE TABLE subscription_custom_schedule (
    id BIGSERIAL PRIMARY KEY,

    subscription_item_id VARCHAR(30) NOT NULL
    REFERENCES subscription_items(id)
    ON DELETE CASCADE,

    subscription_id VARCHAR(30) NOT NULL
    REFERENCES subscriptions(id)
    ON DELETE CASCADE,
    
    delivery_date DATE NOT NULL,

    m_quantity NUMERIC(10,2) DEFAULT 0,

    e_quantity NUMERIC(10,2) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(subscription_item_id, delivery_date)
);

CREATE INDEX idx_custom_dates_date
ON subscription_custom_schedule(delivery_date);

CREATE INDEX idx_custom_dates_item
ON subscription_custom_schedule(subscription_item_id);