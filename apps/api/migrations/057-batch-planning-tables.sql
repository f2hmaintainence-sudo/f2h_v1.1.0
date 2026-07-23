-- ═══════════════════════════════════════════════════════════════
-- Batch Planning Tables for OR-Tools VRP Integration
-- ═══════════════════════════════════════════════════════════════

-- Batch planning jobs table
CREATE TABLE IF NOT EXISTS batch_planning_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id VARCHAR(30) NOT NULL REFERENCES branches(branch_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  shift_type VARCHAR(20) NOT NULL CHECK (shift_type IN ('morning', 'evening')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_orders INT DEFAULT 0,
  total_vehicles INT DEFAULT 0,
  total_distance NUMERIC(10,2) DEFAULT 0,
  total_time INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_jobs_branch_date ON batch_planning_jobs(branch_id, date, shift_type);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_planning_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_created ON batch_planning_jobs(created_at DESC);

-- Batch planning routes table (stores VRP results per vehicle)
CREATE TABLE IF NOT EXISTS batch_planning_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES batch_planning_jobs(id) ON DELETE CASCADE,
  vehicle_id VARCHAR(50) NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
  route_data JSONB NOT NULL,
  total_distance NUMERIC(10,2) DEFAULT 0,
  total_orders INT DEFAULT 0,
  estimated_time INT DEFAULT 0,
  sequence_number INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_routes_job ON batch_planning_routes(job_id);
CREATE INDEX IF NOT EXISTS idx_batch_routes_vehicle ON batch_planning_routes(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_batch_routes_sequence ON batch_planning_routes(job_id, sequence_number);

-- Trigger to update batch_planning_jobs updated_at
CREATE OR REPLACE FUNCTION update_batch_planning_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_batch_jobs_updated_at ON batch_planning_jobs;
CREATE TRIGGER trigger_update_batch_jobs_updated_at
BEFORE UPDATE ON batch_planning_jobs
FOR EACH ROW EXECUTE FUNCTION update_batch_planning_jobs_updated_at();

-- Comment for documentation
COMMENT ON TABLE batch_planning_jobs IS 'Batch planning jobs for subscription delivery optimization using OR-Tools VRP';
COMMENT ON TABLE batch_planning_routes IS 'Optimized routes per vehicle from batch planning jobs';
