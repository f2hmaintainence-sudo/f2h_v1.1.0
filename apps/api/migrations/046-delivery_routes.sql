CREATE TABLE delivery_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(30) NOT NULL REFERENCES branches(branch_id) ON DELETE CASCADE,
    sector_index INT NOT NULL,
    route_name VARCHAR(150) NOT NULL,
    shift_type delivery_slot_enum NOT NULL DEFAULT 'morning',
    delivery_partner_id VARCHAR(50) DEFAULT NULL,
    max_stops INT DEFAULT 80,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_routes_branch_sector ON delivery_routes(branch_id, sector_index);
CREATE INDEX idx_routes_boy ON delivery_routes(delivery_partner_id);
