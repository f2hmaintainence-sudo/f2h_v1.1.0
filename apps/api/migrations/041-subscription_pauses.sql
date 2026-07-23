-- =========================================================
-- 6. SUBSCRIPTION PAUSES
-- Vacation / temporary stop
-- =========================================================

CREATE TABLE subscription_pauses (
    id BIGSERIAL PRIMARY KEY,

    subscription_id VARCHAR(30) NOT NULL
    REFERENCES subscriptions(id)
    ON DELETE CASCADE,
    subscription_item_id VARCHAR(30) NOT NULL
    REFERENCES subscription_items(id)
    ON DELETE CASCADE, --which item is paused 
    
    start_date DATE NOT NULL,
    end_date DATE NOT NULL, --pause until this date

    reason TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pauses_sub
ON subscription_pauses(subscription_id);

CREATE INDEX idx_pauses_dates
ON subscription_pauses(start_date, end_date);