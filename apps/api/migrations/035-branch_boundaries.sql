DROP TABLE IF EXISTS branch_boundaries CASCADE;
CREATE TABLE branch_boundaries (
    id SERIAL PRIMARY KEY,
    boundary_id    VARCHAR(50) DEFAULT NULL,
    branch_id      VARCHAR(30) NOT NULL REFERENCES branches(branch_id) ON DELETE CASCADE,
    boundary_name  VARCHAR(100),
    boundary_type  VARCHAR(50),
    sequence_order INT  NOT NULL,
    latitude       DECIMAL(10, 7) NOT NULL,
    longitude      DECIMAL(10, 7) NOT NULL,
    is_active      BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMP DEFAULT NOW(),
    updated_at     TIMESTAMP DEFAULT NOW(),
    created_by     VARCHAR(100),
    updated_by     VARCHAR(100),
    deleted_at     TIMESTAMPTZ DEFAULT NULL,
    UNIQUE (branch_id, sequence_order)
);
