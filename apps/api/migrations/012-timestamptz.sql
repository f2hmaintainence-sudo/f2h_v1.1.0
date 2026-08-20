-- 012-timestamptz.sql
--
--  ⚠  NOT SAFE TO RUN UNATTENDED. Read this header before applying. ⚠
--
-- The schema mixes 250 `timestamp with time zone` columns with 117 naive
-- `timestamp` columns — including within a single table: `orders.created_at` is
-- naive while `orders.delivered_at` is timezone-aware.
--
-- Why it matters here: the business runs on IST slot boundaries
-- (@Cron(..., { timeZone: 'Asia/Kolkata' })), the PostgreSQL server session
-- reports Europe/Berlin, and the Node process runs in IST. A naive value written
-- by one and compared against a date computed by the other silently shifts a
-- delivery into the wrong slot near midnight — a bug that appears once a day, at
-- 23:55.
--
-- ── Before applying ─────────────────────────────────────────────────────────
-- 1. CONFIRM THE SOURCE TIMEZONE. Sampling on 2026-08-19 showed naive values in
--    `orders.created_at` holding IST wall-clock (written by the Node process),
--    while `NOW()`/`CURRENT_TIMESTAMP` defaults would have written Berlin local
--    time. Rows from the two sources need different conversions, and only the
--    team knows which writer produced which rows. Verify per table:
--
--      SELECT created_at, created_at AT TIME ZONE 'Asia/Kolkata' AS as_ist,
--             created_at AT TIME ZONE 'Europe/Berlin'            AS as_berlin
--        FROM orders ORDER BY created_at DESC LIMIT 20;
--
--    Compare against a known-correct timestamptz column on the same row.
--
-- 2. THIS REWRITES EVERY ROW. `ALTER COLUMN ... TYPE timestamptz` takes an ACCESS
--    EXCLUSIVE lock and rewrites the table. Run it in a maintenance window, table
--    by table, largest last — not as one transaction across 117 columns.
--
-- 3. Set TZ=UTC on the API process and do all IST reasoning explicitly at the
--    boundary, so new writes stop depending on host configuration.
--
-- 4. Leave date-only business columns (`orders.scheduled_date`, `run_date`) as
--    `date`. They are calendar facts, not instants, and both DB services already
--    parse OID 1082 as a raw 'YYYY-MM-DD' string, which is correct.
--
-- ── Applying ────────────────────────────────────────────────────────────────
-- Replace SOURCE_TZ below with the timezone you confirmed in step 1, then run the
-- statements for one table at a time.
--
-- \set SOURCE_TZ 'Asia/Kolkata'
--
-- Statements are commented out deliberately: this file is a reviewed plan, not
-- something the migration runner should apply on its own.

-- ── orders ──────────────────────────────────────────────────────────────
-- ALTER TABLE public.orders
--   ALTER COLUMN assigned_at TYPE timestamptz
--   USING assigned_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.orders
--   ALTER COLUMN created_at TYPE timestamptz
--   USING created_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.orders
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.orders
--   ALTER COLUMN delivery_time TYPE timestamptz
--   USING delivery_time AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.orders
--   ALTER COLUMN updated_at TYPE timestamptz
--   USING updated_at AT TIME ZONE :'SOURCE_TZ';

-- ── subscriptions ───────────────────────────────────────────────────────
-- ALTER TABLE public.subscriptions
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── customer_bills ──────────────────────────────────────────────────────
-- ALTER TABLE public.customer_bills
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── customer_bill_items ─────────────────────────────────────────────────
-- ALTER TABLE public.customer_bill_items
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── customer_wallet_transactions ────────────────────────────────────────
-- ALTER TABLE public.customer_wallet_transactions
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── payments ────────────────────────────────────────────────────────────
-- ALTER TABLE public.payments
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── payment_transactions ────────────────────────────────────────────────
-- ALTER TABLE public.payment_transactions
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── delivery_runs ───────────────────────────────────────────────────────
-- ALTER TABLE public.delivery_runs
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── delivery_run_addresses ──────────────────────────────────────────────
-- ALTER TABLE public.delivery_run_addresses
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── role_assignments ────────────────────────────────────────────────────
-- ALTER TABLE public.role_assignments
--   ALTER COLUMN created_at TYPE timestamptz
--   USING created_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.role_assignments
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.role_assignments
--   ALTER COLUMN updated_at TYPE timestamptz
--   USING updated_at AT TIME ZONE :'SOURCE_TZ';

-- ── admin_audit_logs ────────────────────────────────────────────────────
-- ALTER TABLE public.admin_audit_logs
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── api_integrations_config ─────────────────────────────────────────────
-- ALTER TABLE public.api_integrations_config
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── app_configs ─────────────────────────────────────────────────────────
-- ALTER TABLE public.app_configs
--   ALTER COLUMN created_at TYPE timestamptz
--   USING created_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.app_configs
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.app_configs
--   ALTER COLUMN published_date TYPE timestamptz
--   USING published_date AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.app_configs
--   ALTER COLUMN updated_at TYPE timestamptz
--   USING updated_at AT TIME ZONE :'SOURCE_TZ';

-- ── auth_logs ───────────────────────────────────────────────────────────
-- ALTER TABLE public.auth_logs
--   ALTER COLUMN created_at TYPE timestamptz
--   USING created_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.auth_logs
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.auth_logs
--   ALTER COLUMN last_activity_at TYPE timestamptz
--   USING last_activity_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.auth_logs
--   ALTER COLUMN login_at TYPE timestamptz
--   USING login_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.auth_logs
--   ALTER COLUMN logout_at TYPE timestamptz
--   USING logout_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.auth_logs
--   ALTER COLUMN updated_at TYPE timestamptz
--   USING updated_at AT TIME ZONE :'SOURCE_TZ';

-- ── auth_otp_challenges ─────────────────────────────────────────────────
-- ALTER TABLE public.auth_otp_challenges
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── cache ───────────────────────────────────────────────────────────────
-- ALTER TABLE public.cache
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── cache_locks ─────────────────────────────────────────────────────────
-- ALTER TABLE public.cache_locks
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── catalog_subscription_config ─────────────────────────────────────────
-- ALTER TABLE public.catalog_subscription_config
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── contact_enquiries ───────────────────────────────────────────────────
-- ALTER TABLE public.contact_enquiries
--   ALTER COLUMN created_at TYPE timestamptz
--   USING created_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.contact_enquiries
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.contact_enquiries
--   ALTER COLUMN updated_at TYPE timestamptz
--   USING updated_at AT TIME ZONE :'SOURCE_TZ';

-- ── container_transactions ──────────────────────────────────────────────
-- ALTER TABLE public.container_transactions
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── customer_activity_logs ──────────────────────────────────────────────
-- ALTER TABLE public.customer_activity_logs
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── customer_addresses ──────────────────────────────────────────────────
-- ALTER TABLE public.customer_addresses
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── customer_container_balances ─────────────────────────────────────────
-- ALTER TABLE public.customer_container_balances
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── customer_feedback ───────────────────────────────────────────────────
-- ALTER TABLE public.customer_feedback
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── delivery_calendar ───────────────────────────────────────────────────
-- ALTER TABLE public.delivery_calendar
--   ALTER COLUMN created_at TYPE timestamptz
--   USING created_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.delivery_calendar
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.delivery_calendar
--   ALTER COLUMN updated_at TYPE timestamptz
--   USING updated_at AT TIME ZONE :'SOURCE_TZ';

-- ── delivery_dispatch_items ─────────────────────────────────────────────
-- ALTER TABLE public.delivery_dispatch_items
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── delivery_leave_requests ─────────────────────────────────────────────
-- ALTER TABLE public.delivery_leave_requests
--   ALTER COLUMN created_at TYPE timestamptz
--   USING created_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.delivery_leave_requests
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.delivery_leave_requests
--   ALTER COLUMN notified_at TYPE timestamptz
--   USING notified_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.delivery_leave_requests
--   ALTER COLUMN updated_at TYPE timestamptz
--   USING updated_at AT TIME ZONE :'SOURCE_TZ';

-- ── delivery_location_logs ──────────────────────────────────────────────
-- ALTER TABLE public.delivery_location_logs
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.delivery_location_logs
--   ALTER COLUMN recorded_at TYPE timestamptz
--   USING recorded_at AT TIME ZONE :'SOURCE_TZ';

-- ── delivery_partner_locations ──────────────────────────────────────────
-- ALTER TABLE public.delivery_partner_locations
--   ALTER COLUMN recorded_at TYPE timestamptz
--   USING recorded_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.delivery_partner_locations
--   ALTER COLUMN updated_at TYPE timestamptz
--   USING updated_at AT TIME ZONE :'SOURCE_TZ';

-- ── device_information ──────────────────────────────────────────────────
-- ALTER TABLE public.device_information
--   ALTER COLUMN created_at TYPE timestamptz
--   USING created_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.device_information
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.device_information
--   ALTER COLUMN updated_at TYPE timestamptz
--   USING updated_at AT TIME ZONE :'SOURCE_TZ';

-- ── device_sessions ─────────────────────────────────────────────────────
-- ALTER TABLE public.device_sessions
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── management_staff ────────────────────────────────────────────────────
-- ALTER TABLE public.management_staff
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── notification_recipients ─────────────────────────────────────────────
-- ALTER TABLE public.notification_recipients
--   ALTER COLUMN created_at TYPE timestamptz
--   USING created_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.notification_recipients
--   ALTER COLUMN delete_on TYPE timestamptz
--   USING delete_on AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.notification_recipients
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.notification_recipients
--   ALTER COLUMN notified_at TYPE timestamptz
--   USING notified_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.notification_recipients
--   ALTER COLUMN read_at TYPE timestamptz
--   USING read_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.notification_recipients
--   ALTER COLUMN remind_at TYPE timestamptz
--   USING remind_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.notification_recipients
--   ALTER COLUMN restored_at TYPE timestamptz
--   USING restored_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.notification_recipients
--   ALTER COLUMN updated_at TYPE timestamptz
--   USING updated_at AT TIME ZONE :'SOURCE_TZ';

-- ── notifications ───────────────────────────────────────────────────────
-- ALTER TABLE public.notifications
--   ALTER COLUMN created_at TYPE timestamptz
--   USING created_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.notifications
--   ALTER COLUMN delete_on TYPE timestamptz
--   USING delete_on AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.notifications
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.notifications
--   ALTER COLUMN restored_at TYPE timestamptz
--   USING restored_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.notifications
--   ALTER COLUMN updated_at TYPE timestamptz
--   USING updated_at AT TIME ZONE :'SOURCE_TZ';

-- ── order_batch_items ───────────────────────────────────────────────────
-- ALTER TABLE public.order_batch_items
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── order_batches ───────────────────────────────────────────────────────
-- ALTER TABLE public.order_batches
--   ALTER COLUMN created_at TYPE timestamptz
--   USING created_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.order_batches
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.order_batches
--   ALTER COLUMN updated_at TYPE timestamptz
--   USING updated_at AT TIME ZONE :'SOURCE_TZ';

-- ── otp_rate_limit_logs ─────────────────────────────────────────────────
-- ALTER TABLE public.otp_rate_limit_logs
--   ALTER COLUMN created_at TYPE timestamptz
--   USING created_at AT TIME ZONE :'SOURCE_TZ';

-- ── password_history ────────────────────────────────────────────────────
-- ALTER TABLE public.password_history
--   ALTER COLUMN created_at TYPE timestamptz
--   USING created_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.password_history
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── product_banner ──────────────────────────────────────────────────────
-- ALTER TABLE public.product_banner
--   ALTER COLUMN created_at TYPE timestamptz
--   USING created_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.product_banner
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.product_banner
--   ALTER COLUMN updated_at TYPE timestamptz
--   USING updated_at AT TIME ZONE :'SOURCE_TZ';

-- ── product_images ──────────────────────────────────────────────────────
-- ALTER TABLE public.product_images
--   ALTER COLUMN created_at TYPE timestamptz
--   USING created_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.product_images
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.product_images
--   ALTER COLUMN updated_at TYPE timestamptz
--   USING updated_at AT TIME ZONE :'SOURCE_TZ';

-- ── product_subscription_slot_rules ─────────────────────────────────────
-- ALTER TABLE public.product_subscription_slot_rules
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── production_plans ────────────────────────────────────────────────────
-- ALTER TABLE public.production_plans
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── purchase_entries ────────────────────────────────────────────────────
-- ALTER TABLE public.purchase_entries
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── referrals ───────────────────────────────────────────────────────────
-- ALTER TABLE public.referrals
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── refunds ─────────────────────────────────────────────────────────────
-- ALTER TABLE public.refunds
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── roles ───────────────────────────────────────────────────────────────
-- ALTER TABLE public.roles
--   ALTER COLUMN created_at TYPE timestamptz
--   USING created_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.roles
--   ALTER COLUMN delete_on TYPE timestamptz
--   USING delete_on AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.roles
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.roles
--   ALTER COLUMN restored_at TYPE timestamptz
--   USING restored_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.roles
--   ALTER COLUMN updated_at TYPE timestamptz
--   USING updated_at AT TIME ZONE :'SOURCE_TZ';

-- ── stock_balances ──────────────────────────────────────────────────────
-- ALTER TABLE public.stock_balances
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── subscription_custom_schedule ────────────────────────────────────────
-- ALTER TABLE public.subscription_custom_schedule
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── subscription_global_config ──────────────────────────────────────────
-- ALTER TABLE public.subscription_global_config
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── subscription_logs ───────────────────────────────────────────────────
-- ALTER TABLE public.subscription_logs
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── subscription_pauses ─────────────────────────────────────────────────
-- ALTER TABLE public.subscription_pauses
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── subscription_renewal_attempts ───────────────────────────────────────
-- ALTER TABLE public.subscription_renewal_attempts
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── subscription_weekly_schedule ────────────────────────────────────────
-- ALTER TABLE public.subscription_weekly_schedule
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── support_tickets ─────────────────────────────────────────────────────
-- ALTER TABLE public.support_tickets
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';

-- ── user_devices ────────────────────────────────────────────────────────
-- ALTER TABLE public.user_devices
--   ALTER COLUMN created_at TYPE timestamptz
--   USING created_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.user_devices
--   ALTER COLUMN deleted_at TYPE timestamptz
--   USING deleted_at AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.user_devices
--   ALTER COLUMN last_used TYPE timestamptz
--   USING last_used AT TIME ZONE :'SOURCE_TZ';
-- ALTER TABLE public.user_devices
--   ALTER COLUMN revoked_at TYPE timestamptz
--   USING revoked_at AT TIME ZONE :'SOURCE_TZ';
