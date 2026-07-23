-- =========================================================
-- ALTER SUBSCRIPTIONS FOR NEW PAUSE ARCHITECTURE
-- =========================================================

ALTER TABLE subscriptions RENAME COLUMN pause_start_date TO pause_from_date;
ALTER TABLE subscriptions RENAME COLUMN pause_end_date TO pause_to_date;
ALTER TABLE subscriptions ALTER COLUMN pause_from_date DROP NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN pause_to_date DROP NOT NULL;
