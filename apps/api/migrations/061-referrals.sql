CREATE TABLE referrals (
    id BIGSERIAL PRIMARY KEY,

    refer_id VARCHAR(30) UNIQUE NOT NULL,
    -- REF000001

    referrer_customer_id VARCHAR(30) NOT NULL
        REFERENCES customers(customer_id),

    referred_customer_id VARCHAR(30) NOT NULL
        REFERENCES customers(customer_id),

    referral_code VARCHAR(30),

    referrer_reward_amount NUMERIC(10,2) DEFAULT 0,

    referred_reward_amount NUMERIC(10,2) DEFAULT 0,

    status VARCHAR(20) DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'registered',
                'first_order',
                'rewarded',
                'cancelled'
            )
        ),

    rewarded_at TIMESTAMPTZ,

    remarks TEXT,

    created_at TIMESTAMPTZ DEFAULT now(),

    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(referrer_customer_id, referred_customer_id)
);
CREATE INDEX idx_referrals_referrer
ON referrals(referrer_customer_id);

CREATE INDEX idx_referrals_referred
ON referrals(referred_customer_id);

CREATE INDEX idx_referrals_status
ON referrals(status);

CREATE INDEX idx_referrals_code
ON referrals(referral_code);