CREATE TABLE customer_wallet_transactions (
    id BIGSERIAL PRIMARY KEY,

    transaction_id  VARCHAR(20) DEFAULT ('WTR_' || upper(substr(gen_random_uuid()::text, 1, 12))),
    
    customer_id VARCHAR(30) NOT NULL
    REFERENCES customers(customer_id)
    ON DELETE CASCADE,

    transaction_type VARCHAR(20) NOT NULL,
    -- credit / debit / refund / cashback

    amount NUMERIC(12,2) NOT NULL,

    balance_after NUMERIC(12,2),

    reference_type VARCHAR(30),
    -- order / subscription / refund / manual

    reference_id VARCHAR(30),

    remarks TEXT,

    created_by VARCHAR(30),

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wallet_customer
ON customer_wallet_transactions(customer_id);