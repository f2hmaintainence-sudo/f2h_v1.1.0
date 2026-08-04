CREATE TABLE branch_sectors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    branch_id VARCHAR(30) NOT NULL,

    sector_index INTEGER NOT NULL,

    sector_name VARCHAR(100) NOT NULL,

    delivery_partner_id VARCHAR(30),

    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_branch_sectors_branch_id
ON branch_sectors(branch_id);

CREATE INDEX idx_branch_sectors_active
ON branch_sectors(is_active);

CREATE INDEX idx_branch_sectors_delivery_partner
ON branch_sectors(delivery_partner_id);