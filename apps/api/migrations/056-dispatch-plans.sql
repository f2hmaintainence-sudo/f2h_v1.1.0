CREATE TABLE IF NOT EXISTS dispatch_plans (
  id                INT   PRIMARY KEY ,
  dispatch_number   VARCHAR(30)   NOT NULL UNIQUE DEFAULT gen_random_uuid()::varchar(30),
  source_warehouse_id INTEGER     DEFAULT NULL,
  target_branch_id  VARCHAR       REFERENCES branches(branch_id),
  dispatch_date     DATE          NOT NULL,
  status            VARCHAR(20)   DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'picking', 'dispatched', 'in_transit', 'received', 'cancelled')),
  total_items       INTEGER       DEFAULT 0,
  total_quantity    INTEGER       DEFAULT 0,
  dispatched_by     VARCHAR       DEFAULT NULL,
  dispatched_at     TIMESTAMPTZ   DEFAULT NULL,
  received_by       VARCHAR       DEFAULT NULL,
  received_at       TIMESTAMPTZ   DEFAULT NULL,
  vehicle_number    VARCHAR(30)   DEFAULT NULL,
  notes             TEXT          DEFAULT NULL,
  created_by        VARCHAR       DEFAULT NULL,
  created_at        TIMESTAMPTZ   DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   DEFAULT NOW()
);