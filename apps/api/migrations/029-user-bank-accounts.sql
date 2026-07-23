CREATE TABLE user_bank_accounts (
    id BIGSERIAL PRIMARY KEY,

    delivery_partner_id VARCHAR(30) NOT NULL,

    account_holder_name VARCHAR(150) NOT NULL,

    bank_name VARCHAR(100) NOT NULL,

    account_number VARCHAR(50) NOT NULL,

    ifsc_code VARCHAR(20) NOT NULL,

    branch_name VARCHAR(100),

    upi_id VARCHAR(100),

    cancelled_cheque_image TEXT,

    verification_status VARCHAR(20) DEFAULT 'pending',
    -- pending, verified, rejected

    verified_by VARCHAR(30),
    verified_at TIMESTAMPTZ,

    rejection_reason TEXT,

    is_primary BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);