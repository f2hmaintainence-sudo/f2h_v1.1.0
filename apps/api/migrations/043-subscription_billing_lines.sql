-- =========================================================
-- 8. SUBSCRIPTION BILLING LINES
-- Invoice line level billing
-- =========================================================

CREATE TABLE subscription_billing_lines (
    id BIGSERIAL PRIMARY KEY,

    snapshot_id BIGINT NOT NULL
    REFERENCES subscription_daily_snapshots(id)
    ON DELETE CASCADE,

    subscription_id VARCHAR(30) NOT NULL,

    customer_id VARCHAR(30) NOT NULL,

    billing_date DATE NOT NULL,

    quantity NUMERIC(10,2) NOT NULL,

    price NUMERIC(10,2) NOT NULL,

    amount NUMERIC(12,2) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_billing_sub
ON subscription_billing_lines(subscription_id);

CREATE INDEX idx_billing_customer
ON subscription_billing_lines(customer_id);

CREATE INDEX idx_billing_date
ON subscription_billing_lines(billing_date);
