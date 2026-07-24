CREATE TABLE IF NOT EXISTS subscription_logs (
    id BIGSERIAL PRIMARY KEY,
    subscription_id VARCHAR(50),
    subscription_item_id VARCHAR(50),
    customer_id VARCHAR(50),
    action VARCHAR(50) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_by VARCHAR(30),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_sub ON subscription_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_logs_customer ON subscription_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_logs_action ON subscription_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_created ON subscription_logs(created_at);