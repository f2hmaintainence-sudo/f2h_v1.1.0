-- CREATE TABLE delivery_runs (
--     id VARCHAR(30) PRIMARY KEY,

--     branch_id VARCHAR(30) NOT NULL,

--     delivery_partner_id VARCHAR(30) NOT NULL,

--     run_date DATE NOT NULL,

--     slot VARCHAR(5) NOT NULL,
    
--     route_json JSONB,

--     dispatched_at TIMESTAMPTZ,
    
--     started_at TIMESTAMPTZ,

--     completed_at TIMESTAMPTZ,

--     created_at TIMESTAMPTZ DEFAULT now(),

--     updated_at TIMESTAMPTZ DEFAULT now()
-- );

-- CREATE INDEX idx_delivery_runs_date
-- ON delivery_runs(run_date);

-- CREATE INDEX idx_delivery_runs_boy
-- ON delivery_runs(delivery_partner_id);

-- CREATE INDEX idx_delivery_runs_slot
-- ON delivery_runs(slot);



CREATE TABLE IF NOT EXISTS delivery_runs (
  id              SERIAL   PRIMARY KEY ,
  run_id      VARCHAR(30)   NOT NULL,
  delivery_partner_id VARCHAR(30) NOT NULL REFERENCES delivery_partners(delivery_partner_id),
  branch_id       VARCHAR       REFERENCES branches(branch_id),
  run_date        DATE          NOT NULL DEFAULT CURRENT_DATE,
  delivery_slot   VARCHAR(30)   NOT NULL DEFAULT 'morning'
    CHECK (delivery_slot IN ('morning','evening')),
  status          VARCHAR(20)   DEFAULT 'planned'
    CHECK (status IN ('planned', 'assigned', 'in_progress', 'completed', 'cancelled', 'partial')),
  assignment_method VARCHAR(30) DEFAULT 'auto_balanced'
    CHECK (assignment_method IN ('auto_history', 'auto_cluster', 'auto_balanced', 'manual')),
  total_addresses   INTEGER     DEFAULT 0,
  completed_addresses INTEGER   DEFAULT 0,
  failed_addresses   INTEGER    DEFAULT 0,
  planned_start_time TIMESTAMPTZ DEFAULT NULL,
  actual_start_time  TIMESTAMPTZ DEFAULT NULL,
  actual_end_time    TIMESTAMPTZ DEFAULT NULL,
  total_distance_km  DECIMAL(8,2) DEFAULT NULL,
  assigned_by     VARCHAR       DEFAULT NULL,
  notes           TEXT          DEFAULT NULL,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_runs_number
  ON delivery_runs (run_id);
CREATE INDEX IF NOT EXISTS idx_delivery_runs_partner_date
  ON delivery_runs (delivery_partner_id, run_date, delivery_slot);
CREATE INDEX IF NOT EXISTS idx_delivery_runs_branch_date
  ON delivery_runs (branch_id, run_date);
CREATE INDEX IF NOT EXISTS idx_delivery_runs_status
  ON delivery_runs (status) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_delivery_runs_date
  ON delivery_runs (run_date DESC);