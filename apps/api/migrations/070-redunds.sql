-- =========================================================
-- REFUND STATUS ENUM
-- =========================================================

CREATE TYPE refund_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected',
    'processed',
    'cancelled'
);

-- =========================================================
-- REFUNDS
-- =========================================================

CREATE TABLE refunds (
    id BIGSERIAL PRIMARY KEY,

    refund_number VARCHAR(50) UNIQUE NOT NULL,

    customer_id VARCHAR(30) NOT NULL
        REFERENCES customers(customer_id),

    order_id VARCHAR(30),

    refund_amount NUMERIC(12,2) NOT NULL,

    refund_type VARCHAR(30) DEFAULT 'wallet'
        CHECK (refund_type IN (
            'wallet',
            'bank_transfer',
            'cash',
            'upi'
        )),

    status refund_status_enum DEFAULT 'pending',

    reason TEXT,

    approved_by VARCHAR(30),

    approved_at TIMESTAMPTZ,

    processed_at TIMESTAMPTZ,

    transaction_id VARCHAR(30),

    created_at TIMESTAMPTZ DEFAULT now(),

    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX idx_refunds_customer
ON refunds(customer_id);

CREATE INDEX idx_refunds_order
ON refunds(order_id);

CREATE INDEX idx_refunds_status
ON refunds(status);

CREATE INDEX idx_refunds_created
ON refunds(created_at);