CREATE TABLE customers (
    id BIGSERIAL PRIMARY KEY,

    customer_id VARCHAR(50) UNIQUE NOT NULL,

    subscription_number VARCHAR(30) UNIQUE,

    first_name VARCHAR(50) NOT NULL,

    last_name VARCHAR(50) NOT NULL,

    mobile VARCHAR(20) NOT NULL UNIQUE,

    alternate_mobile VARCHAR(20),

    email VARCHAR(150),

    gender VARCHAR(20),

    dob DATE,

    profile_image TEXT,

    branch_id VARCHAR(30) NOT NULL,

    customer_status customer_status_enum

    DEFAULT 'active',

    customer_type VARCHAR(20) DEFAULT 'regular',
    -- regular / vendor / apartment / office

    wallet_balance NUMERIC(12,2) DEFAULT 0.00,

    reward_points INTEGER DEFAULT 0,

    referred_by VARCHAR(30),
    is_postpaid_enabled BOOLEAN DEFAULT 'false',

    postpaid_credit_limit  NUMERIC(12,2) DEFAULT 0.00,
    
    notes TEXT,

    created_by VARCHAR(30),

    created_at TIMESTAMPTZ DEFAULT now(),

    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customers_mobile
ON customers(mobile);

CREATE INDEX idx_customers_branch
ON customers(branch_id);
