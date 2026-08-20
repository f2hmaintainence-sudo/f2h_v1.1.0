-- ============================================================================
-- ChronoSparkSolutions — A Software Company
-- © 2026 ChronoSparkSolutions. All rights reserved.
--
-- Project     : F2H Fresh
-- File        : 016-subscription-refund-review-state.sql
-- Description : Adds the "Reviewed" step to the prepaid subscription refund
--               workflow: Eligible → Reviewed → Approved → Processed.
--
--               subscription_refund_candidates.status previously allowed only
--               pending / approved / refunded / rejected, so a reviewed-but-not-
--               yet-approved candidate had nowhere to live. This widens the
--               CHECK and records who reviewed the candidate and when.
--
--               No new tables: eligibility, approval, processing and duplicate
--               prevention are all already covered by
--               subscription_refund_candidates (uq_refund_candidate) and
--               subscription_refund_payouts.
-- ============================================================================

BEGIN;

ALTER TABLE subscription_refund_candidates
  DROP CONSTRAINT IF EXISTS subscription_refund_candidates_status_check;

ALTER TABLE subscription_refund_candidates
  ADD CONSTRAINT subscription_refund_candidates_status_check
  CHECK (status IN ('pending', 'reviewed', 'approved', 'refunded', 'rejected'));

ALTER TABLE subscription_refund_candidates
  ADD COLUMN IF NOT EXISTS reviewed_by  character varying(30),
  ADD COLUMN IF NOT EXISTS reviewed_at  timestamptz;

COMMENT ON COLUMN subscription_refund_candidates.reviewed_by IS
  'Admin who reviewed the calculated refund before approval';
COMMENT ON COLUMN subscription_refund_candidates.reviewed_at IS
  'When the candidate was reviewed (status moved pending -> reviewed)';

-- Approval queues are read by status; reviewed rows are the ones awaiting sign-off.
CREATE INDEX IF NOT EXISTS idx_src_reviewed
  ON subscription_refund_candidates (status, customer_id)
  WHERE status = 'reviewed' AND deleted_at IS NULL;

COMMIT;

-- ── Verification ────────────────────────────────────────────────────────────
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'subscription_refund_candidates'::regclass AND contype = 'c';
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'subscription_refund_candidates'
--    AND column_name IN ('reviewed_by', 'reviewed_at');
