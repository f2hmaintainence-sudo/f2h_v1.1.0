-- =========================================================
-- SUBSCRIPTION RENEWAL ATTEMPTS
-- Tracks every auto/manual renewal attempt for audit
-- =========================================================

CREATE TABLE subscription_renewal_attempts (
    id BIGSERIAL PRIMARY KEY,

    subscription_id VARCHAR(50) NOT NULL,

    customer_id VARCHAR(30) NOT NULL
    REFERENCES customers(customer_id),

    attempt_type VARCHAR(20) NOT NULL,
    -- auto_renew / retry / manual / postpaid_convert

    payment_type VARCHAR(20) NOT NULL,
    -- prepaid / postpaid

    renewal_amount NUMERIC(12,2) NOT NULL,

    wallet_balance_at_attempt NUMERIC(12,2),

    bill_id VARCHAR(30),
    -- FK to customer_bills if a bill was created

    status VARCHAR(20) NOT NULL,
    -- success / failed_insufficient_balance / failed_credit_limit / failed_outstanding

    failure_reason TEXT,

    old_end_date DATE,

    new_end_date DATE,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_renewal_attempts_sub
ON subscription_renewal_attempts(subscription_id);

CREATE INDEX idx_renewal_attempts_customer
ON subscription_renewal_attempts(customer_id);

CREATE INDEX idx_renewal_attempts_status
ON subscription_renewal_attempts(status);
