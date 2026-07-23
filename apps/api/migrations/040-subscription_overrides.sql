-- =========================================================
-- 5. SUBSCRIPTION OVERRIDES
-- Temporary modifications
-- EX / COD / cancel / replace
-- =========================================================

CREATE TABLE subscription_overrides (
    id BIGSERIAL PRIMARY KEY,

    subscription_item_id VARCHAR(30) NOT NULL
    REFERENCES subscription_items(id)
    ON DELETE CASCADE,

    override_date DATE NOT NULL,

    m_quantity NUMERIC(10,2) DEFAULT 0,

    e_quantity NUMERIC(10,2) DEFAULT 0,

    override_type subscription_override_type_enum NOT NULL,

    is_paid BOOLEAN DEFAULT false,

    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(subscription_item_id, override_date)
);
CREATE INDEX idx_overrides_date
ON subscription_overrides(override_date);

CREATE INDEX idx_overrides_item
ON subscription_overrides(subscription_item_id);