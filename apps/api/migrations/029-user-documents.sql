CREATE TABLE user_documents (
    id BIGSERIAL PRIMARY KEY,

    delivery_partner_id VARCHAR(30) NOT NULL,

    document_type VARCHAR(30) NOT NULL,
    -- aadhaar, pan, driving_license, police_verification, other

    document_number VARCHAR(100),

    front_image TEXT,
    back_image TEXT,

    issue_date DATE,
    expiry_date DATE,

    verification_status VARCHAR(20) DEFAULT 'pending',
    -- pending, verified, rejected

    verified_by VARCHAR(30),
    verified_at TIMESTAMPTZ,

    rejection_reason TEXT,

    is_primary BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);