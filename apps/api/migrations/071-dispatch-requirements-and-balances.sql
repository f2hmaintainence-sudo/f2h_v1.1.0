-- Migration 071: Dispatch Requirements and Balances

CREATE TABLE IF NOT EXISTS dispatch_requirements (
    id BIGSERIAL PRIMARY KEY,
    run_id VARCHAR(30) NOT NULL REFERENCES delivery_runs(run_id) ON DELETE CASCADE,
    run_date DATE NOT NULL,
    delivery_slot VARCHAR(30) NOT NULL,
    delivery_partner_id VARCHAR(30) NOT NULL REFERENCES delivery_partners(delivery_partner_id) ON DELETE CASCADE,
    product_variant_id VARCHAR(30) NOT NULL,
    required_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'pcs',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(run_id, product_variant_id)
);

CREATE INDEX IF NOT EXISTS idx_dispatch_requirements_date ON dispatch_requirements(run_date);
CREATE INDEX IF NOT EXISTS idx_dispatch_requirements_run ON dispatch_requirements(run_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_requirements_boy ON dispatch_requirements(delivery_partner_id);

CREATE TABLE IF NOT EXISTS dispatch_balances (
    id BIGSERIAL PRIMARY KEY,
    delivery_partner_id VARCHAR(30) NOT NULL REFERENCES delivery_partners(delivery_partner_id) ON DELETE CASCADE,
    product_variant_id VARCHAR(30) NOT NULL,
    run_date DATE NOT NULL,
    delivery_slot VARCHAR(30) NOT NULL,
    dispatched_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
    delivered_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
    returned_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
    damaged_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
    balance_qty NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(delivery_partner_id, product_variant_id, run_date, delivery_slot)
);

CREATE INDEX IF NOT EXISTS idx_dispatch_balances_boy_date ON dispatch_balances(delivery_partner_id, run_date);
