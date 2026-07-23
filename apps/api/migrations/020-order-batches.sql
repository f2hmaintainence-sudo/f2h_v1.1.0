CREATE TABLE order_batches (
    batch_id              VARCHAR(30) PRIMARY KEY,

    branch_id             VARCHAR(30) NOT NULL,

    production_date       DATE NOT NULL,

    slot                  VARCHAR(20),          -- morning/evening/custom
    
    product_id            VARCHAR(30) NOT NULL,
    
    status                VARCHAR(20) DEFAULT 'pending',
    -- pending
    -- processing
    -- prepared
     
    total_quantity        NUMERIC(12,3) DEFAULT 0,

    prepared_quantity     NUMERIC(12,3) DEFAULT 0,

    total_orders          INTEGER  NULL default 0,
    
    order_ids             json   Null default '{}'::json,

    notes                 TEXT,

    created_by            VARCHAR(30),
    updated_by            VARCHAR(30),

    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);