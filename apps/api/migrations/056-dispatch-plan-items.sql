CREATE TABLE IF NOT EXISTS dispatch_plan_items (
  id                INT   PRIMARY KEY,
  dispatch_plan_id  VARCHAR(30)   NOT NULL REFERENCES dispatch_plans(dispatch_number) ON DELETE CASCADE,
  variant_id        VARCHAR       NOT NULL,
  product_id        VARCHAR       DEFAULT NULL,
  required_quantity INTEGER       NOT NULL DEFAULT 0,
  dispatched_quantity INTEGER     DEFAULT 0,
  received_quantity INTEGER       DEFAULT 0,
  unit              VARCHAR(20)   DEFAULT 'pcs',
  notes             TEXT          DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_dispatch_plans_warehouse
  ON dispatch_plans (source_warehouse_id, dispatch_date);
CREATE INDEX IF NOT EXISTS idx_dispatch_plans_branch
  ON dispatch_plans (target_branch_id, dispatch_date);
CREATE INDEX IF NOT EXISTS idx_dispatch_plans_status
  ON dispatch_plans (status) WHERE status NOT IN ('received', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_dispatch_plan_items_plan
  ON dispatch_plan_items (dispatch_plan_id);