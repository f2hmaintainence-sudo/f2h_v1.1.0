CREATE TABLE payments (
    payment_id VARCHAR(30) PRIMARY KEY,

    bill_id VARCHAR(30) NOT NULL
    REFERENCES customer_bills(bill_id),

    customer_id VARCHAR(30) NOT NULL
    REFERENCES customers(customer_id),

    payment_method VARCHAR(20) NOT NULL,
    -- wallet
    -- cod
    -- upi
    -- card
    -- bank_transfer

    amount NUMERIC(12,2) NOT NULL,

    transaction_reference VARCHAR(100),

    payment_status VARCHAR(20) NOT NULL,
    -- pending
    -- success
    -- failed
    -- refunded

    paid_at TIMESTAMPTZ,

    remarks TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);