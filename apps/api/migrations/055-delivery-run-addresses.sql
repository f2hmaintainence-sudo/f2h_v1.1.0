CREATE TABLE delivery_run_addresses (
    id BIGSERIAL PRIMARY KEY,

    run_id VARCHAR(30) NOT NULL
    REFERENCES delivery_runs(id)
    ON DELETE CASCADE,

    address_id VARCHAR(30) NOT NULL,

    sequence_no INTEGER NOT NULL,

    delivery_status VARCHAR(20) DEFAULT 'pending',
    -- pending / delivered / failed / skipped

    delivered_at TIMESTAMPTZ,

    remarks TEXT,

    UNIQUE(run_id, address_id)
);

CREATE INDEX idx_delivery_run_addresses_run
ON delivery_run_addresses(run_id);

CREATE INDEX idx_delivery_run_addresses_status
ON delivery_run_addresses(delivery_status);

