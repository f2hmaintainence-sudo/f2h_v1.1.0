CREATE TABLE user_vehicles (
    id BIGSERIAL PRIMARY KEY,

    delivery_partner_id VARCHAR(30) NOT NULL,

    vehicle_type VARCHAR(20),
    -- bike, scooter, cycle, van, auto

    registration_number VARCHAR(30) NOT NULL,

    brand VARCHAR(50),
    model VARCHAR(50),
    color VARCHAR(30),

    rc_number VARCHAR(50),
    rc_front_image TEXT,
    rc_back_image TEXT,

    insurance_number VARCHAR(50),
    insurance_image TEXT,
    insurance_expiry DATE,

    verification_status VARCHAR(20) DEFAULT 'pending',

    verified_by VARCHAR(30),
    verified_at TIMESTAMPTZ,

    is_primary BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);