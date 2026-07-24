-- =========================================================
-- 3. SUBSCRIPTION WEEKLY SCHEDULE
-- Weekly recurring delivery plan
-- One row per day
-- M&E in same row
-- =========================================================

CREATE TABLE subscription_weekly_schedule (
    id BIGSERIAL PRIMARY KEY AUTO_INCREMENT,

    subscription_item_id VARCHAR(30) NOT NULL
    REFERENCES subscription_items(subscription_item_id)
    ON DELETE CASCADE,

    subscription_id VARCHAR(30) NOT NULL
    REFERENCES subscriptions(subscription_id)
    ON DELETE CASCADE,

    day_of_week SMALLINT NOT NULL,

    m_quantity NUMERIC(10,2) DEFAULT 0,

    e_quantity NUMERIC(10,2) DEFAULT 0,

    effective_from DATE NULL,

    effective_to   DATE NULL,
    
    created_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(subscription_item_id, day_of_week),

    CHECK (day_of_week BETWEEN 0 AND 6)
);

CREATE INDEX idx_week_schedule_item
ON subscription_weekly_schedule(subscription_item_id);
