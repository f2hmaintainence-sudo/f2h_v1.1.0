CREATE TABLE customer_bills (
    bill_id VARCHAR(30) PRIMARY KEY,

    customer_id VARCHAR(30) NOT NULL
    REFERENCES customers(customer_id),

    bill_type VARCHAR(20) NOT NULL,
    -- subscription
    -- order

    reference_id VARCHAR(30) NOT NULL,
    -- subscription_id OR order_id

    payment_type VARCHAR(20) NOT NULL,
    -- prepaid
    -- postpaid
    -- wallet
    -- cod

    billing_from DATE,
    billing_to DATE,

    due_date DATE,

    subtotal NUMERIC(12,2) DEFAULT 0,

    discount_amount NUMERIC(12,2) DEFAULT 0,

    tax_amount NUMERIC(12,2) DEFAULT 0,

    total_amount NUMERIC(12,2) NOT NULL,

    paid_amount NUMERIC(12,2) DEFAULT 0,

    due_amount NUMERIC(12,2) DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    -- draft
    -- unpaid
    -- partial
    -- paid
    -- cancelled

    remarks TEXT,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);