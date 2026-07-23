-- =========================================================
-- 9. SUBSCRIPTION LOGS
-- Audit + debugging
-- =========================================================

CREATE TABLE subscription_logs (
    id BIGSERIAL PRIMARY KEY,

    subscription_id VARCHAR(30),

    subscription_item_id VARCHAR(30),

    action VARCHAR(50) NOT NULL,

    old_data JSONB,

    new_data JSONB,

    created_by VARCHAR(30),

    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_logs_sub
ON subscription_logs(subscription_id);

CREATE INDEX idx_logs_customer
ON subscription_logs(customer_id);

CREATE INDEX idx_logs_action
ON subscription_logs(action);

CREATE INDEX idx_logs_created
ON subscription_logs(created_at);