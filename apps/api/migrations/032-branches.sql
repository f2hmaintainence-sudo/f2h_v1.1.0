CREATE EXTENSION IF NOT EXISTS "pgcrypto";
DROP TABLE IF EXISTS branches CASCADE;
CREATE TABLE branches (
    id BIGSERIAL PRIMARY KEY,

    branch_id VARCHAR(30) UNIQUE NOT NULL,

    branch_name VARCHAR(100) NOT NULL,

    branch_code VARCHAR(20) UNIQUE,

    city VARCHAR(100),

    state VARCHAR(100),

    lat NUMERIC(10,7),

    lng NUMERIC(10,7),

    delivery_radius_km NUMERIC(5,2) DEFAULT 5,

    beffer_zone NUMERIC(5,2) DEFAULT 0,
    
    allow_buffer_order BOOLEAN DEFAULT false,

    center_hex VARCHAR(20),

    sector_count INTEGER DEFAULT 3,

    h3_resolution INTEGER DEFAULT 9,

    manager_id VARCHAR(30),

    contact_mobile VARCHAR(20),

    email VARCHAR(150),

    address TEXT,

    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT now(),

    updated_at TIMESTAMPTZ DEFAULT now(),

    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_branches_branch_id
ON branches(branch_id);

CREATE INDEX idx_branches_active
ON branches(is_active);

CREATE INDEX idx_branches_city
ON branches(city);