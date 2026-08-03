-- =========================================================
-- CONTAINERS
-- Master table for returnable/non-returnable containers
-- =========================================================

CREATE TABLE containers (
    id BIGSERIAL PRIMARY KEY,

    container_id VARCHAR(30) UNIQUE NOT NULL,

    name VARCHAR(100) NOT NULL,
    -- 1 L Bottle
    -- 500 ML Bottle
    -- 250 ML Pouch
    -- 1 KG Curd Tub

    quantity INTEGER NOT NULL DEFAULT 0,
    -- Capacity of the container (e.g. 1000, 500, 250)

    is_returnable BOOLEAN DEFAULT true,

    status VARCHAR(20) DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'inactive'
            )
        ),

    created_at TIMESTAMPTZ DEFAULT now(),

    updated_at TIMESTAMPTZ DEFAULT now(),

    deleted_at TIMESTAMPTZ
);

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX idx_containers_status
ON containers(status);

CREATE INDEX idx_containers_returnable
ON containers(is_returnable);