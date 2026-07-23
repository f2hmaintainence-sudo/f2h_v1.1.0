CREATE TABLE delivery_partners (
    id BIGSERIAL PRIMARY KEY,

    delivery_partner_id VARCHAR(30) UNIQUE NOT NULL,

    full_name VARCHAR(150) NOT NULL,

    phone VARCHAR(20) NOT NULL UNIQUE,

    email VARCHAR(150),

    branch_id VARCHAR(30),

    vehicle_type VARCHAR(50),

    vehicle_number VARCHAR(30),

    daily_salary NUMERIC(10,2) DEFAULT 0,

    is_active BOOLEAN DEFAULT true,

    is_verified BOOLEAN DEFAULT false,

    profile_photo_url TEXT,

    id_proof_url TEXT,

    aadhaar_url TEXT,

    bank_account_number VARCHAR(50),

    bank_ifsc VARCHAR(20),

    bank_name VARCHAR(100),

    account_holder_name VARCHAR(150),

    joined_date DATE,

    current_lat NUMERIC(10,7),

    current_lng NUMERIC(10,7),

    is_available BOOLEAN DEFAULT true,

    max_daily_orders INTEGER DEFAULT 50,

    last_location_at TIMESTAMPTZ,

    average_rating NUMERIC(3,2),

    total_runs INTEGER DEFAULT 0,

    total_deliveries INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT now(),

    updated_at TIMESTAMPTZ DEFAULT now(),

    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_delivery_partners_branch
ON delivery_partners(branch_id);

CREATE INDEX idx_delivery_partners_phone
ON delivery_partners(phone);

CREATE INDEX idx_delivery_partners_active
ON delivery_partners(is_active);

CREATE INDEX idx_delivery_partners_available
ON delivery_partners(is_available);

CREATE INDEX idx_delivery_partners_location
ON delivery_partners(current_lat, current_lng);