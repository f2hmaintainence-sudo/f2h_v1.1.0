-- ============================================================================
-- ChronoSparkSolutions — A Software Company
-- © 2026 ChronoSparkSolutions. All rights reserved.
--
-- Project     : F2H Fresh
-- File        : 018-widen-wallet-transactions-reference-id.sql
-- Description : Expands customer_wallet_transactions columns (reference_id,
--               reference_type, transaction_id, created_by) to VARCHAR(64)
--               to safely accommodate 36-character UUIDs from refund payouts
--               and third-party payment gateways.
-- ============================================================================

BEGIN;

ALTER TABLE customer_wallet_transactions
  ALTER COLUMN reference_id TYPE VARCHAR(64),
  ALTER COLUMN reference_type TYPE VARCHAR(64),
  ALTER COLUMN transaction_id TYPE VARCHAR(64),
  ALTER COLUMN created_by TYPE VARCHAR(64);

COMMIT;
