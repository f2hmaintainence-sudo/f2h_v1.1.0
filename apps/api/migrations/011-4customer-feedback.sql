CREATE TABLE customer_feedback (
    id BIGSERIAL PRIMARY KEY,

    customer_id VARCHAR(30) NOT NULL
    REFERENCES customers(customer_id)
    ON DELETE CASCADE,

    reference_type VARCHAR(30),
    -- order / subscription / delivery

    reference_id VARCHAR(30),

    rating SMALLINT,

    feedback_type VARCHAR(30),
    -- complaint / suggestion / appreciation

    feedback TEXT,

    status VARCHAR(20) DEFAULT 'open',
    -- open / in_progress / resolved

    resolved_by VARCHAR(30),

    resolved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feedback_customer
ON customer_feedback(customer_id);