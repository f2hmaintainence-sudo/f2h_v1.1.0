CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGSERIAL PRIMARY KEY,
    subscription_id VARCHAR(50) NOT NULL UNIQUE,
    subscription_number VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    schedule_type subscription_schedule_type_enum NOT NULL,
    branch_id VARCHAR(30) DEFAULT NULL,
    address_id VARCHAR(30) NOT NULL,
    payment_type subscription_payment_type_enum NOT NULL,
    billing_cycle VARCHAR(20) DEFAULT 'monthly',
    start_date DATE NOT NULL,
    end_date DATE,
    auto_renew BOOLEAN DEFAULT false,
    renewal_grace_days INTEGER DEFAULT 3,
    status VARCHAR(20) DEFAULT 'active',
    pause_from_date DATE,
    pause_to_date DATE,
    pause_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    cancel_reason TEXT,
    notes TEXT,
    metadata JSONB,
    created_by VARCHAR(30),
    updated_by VARCHAR(30),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_dates ON subscriptions(start_date, end_date);