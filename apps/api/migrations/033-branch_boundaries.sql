DROP TABLE IF EXISTS branch_boundaries CASCADE;
CREATE TABLE branch_boundaries (
    id SERIAL PRIMARY KEY,

    boundary_id    VARCHAR(30) UNIQUE NOT NULL,
    branch_id      VARCHAR(30) UNIQUE NOT NULL REFERENCES branches(branch_id) ON DELETE CASCADE,

    geo_bounds     TEXT NOT NULL,
    is_active      BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT NOW(),
    deleted_at    TIMESTAMP DEFAULT NULL
);

CREATE INDEX idx_branch_boundaries_branch_id
ON branch_boundaries(branch_id);

CREATE INDEX idx_branch_boundaries_active
ON branch_boundaries(is_active);

CREATE INDEX idx_branch_boundaries_boundary_id
ON branch_boundaries(boundary_id);