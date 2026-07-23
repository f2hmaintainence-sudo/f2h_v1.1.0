CREATE TABLE customer_activity_logs (
    id BIGSERIAL PRIMARY KEY,

    customer_id VARCHAR(30) NOT NULL
    REFERENCES customers(customer_id)
    ON DELETE CASCADE,

    activity_type VARCHAR(50) NOT NULL,
    -- login / order / subscription / payment

    activity_data JSONB,

    ip_address VARCHAR(100),

    device_info TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customer_activity
ON customer_activity_logs(customer_id);