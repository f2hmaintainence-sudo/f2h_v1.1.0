CREATE TABLE branch_zone_hexes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    branch_id VARCHAR(30) NOT NULL,

    sector_index INTEGER NOT NULL,

    hex_id VARCHAR(20) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_branch_zone_hexes_branch_id
ON branch_zone_hexes(branch_id);

CREATE INDEX idx_branch_zone_hexes_hex_id
ON branch_zone_hexes(hex_id);

CREATE INDEX idx_branch_zone_hexes_active
ON branch_zone_hexes(is_active);