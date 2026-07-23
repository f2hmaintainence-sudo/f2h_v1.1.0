-- =========================================================
-- EXTENSIONS
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1. SUBSCRIPTIONS
-- Customer level subscription container
-- One customer = one active subscription plan
-- =========================================================

CREATE TABLE subscriptions (
    id int PRIMARY KEY,

    subscription_id VARCHAR(50) NOT NULL UNIQUE,

    subscription_number VARCHAR(50) NOT NULL,

    customer_id VARCHAR(30) UNIQUE NOT NULL,

    schedule_type subscription_schedule_type_enum NOT NULL,

    branch_id VARCHAR(30) DEFAULT NULL,

    address_id  VARCHAR(30) NOT NULL,

    payment_type subscription_payment_type_enum NOT NULL,

    billing_cycle VARCHAR(20) DEFAULT 'monthly',
    -- monthly / weekly / custom

    start_date DATE NOT NULL,
    end_date DATE,

    auto_renew BOOLEAN DEFAULT false,

    renewal_grace_days INTEGER DEFAULT 3,

    status VARCHAR(20) DEFAULT 'active',
    -- active / completed / expired / cancelled

    pause_from_date DATE NOT NULL,

    pause_to_date DATE NOT NULL, --pause until this date

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

CREATE INDEX idx_subscriptions_customer
ON subscriptions(customer_id);

CREATE INDEX idx_subscriptions_status
ON subscriptions(status);

CREATE INDEX idx_subscriptions_dates
ON subscriptions(start_date, end_date);