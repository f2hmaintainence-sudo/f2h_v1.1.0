-- ============================================================================
-- ChronoSparkSolutions — A Software Company
-- © 2026 ChronoSparkSolutions. All rights reserved.
--
-- Project     : F2H Fresh
-- File        : 014-email-and-payment-config.sql
-- Description : Seeds the SMTP sender and the Razorpay gateway so both are
--               driven by `api_integrations_config` instead of environment
--               variables. MailService and RazorpayService read this table
--               first and only fall back to the environment.
--
--               SECRETS ARE NOT IN THIS FILE. Migrations are tracked in git, so
--               the SMTP password and the Razorpay private key are written by
--               `npm run seed:integration-secrets`, which reads them from the
--               untracked .env. This file seeds everything else and leaves the
--               secret fields absent so the seeder fills them in.
-- ============================================================================

-- ── Outbound email (Gmail SMTP for info@f2hfresh.com) ───────────────────────
INSERT INTO public.api_integrations_config
    (category, config_key, name, provider, is_active, config_data)
VALUES (
    'email',
    'smtp',
    'F2H Fresh — Primary SMTP',
    'gmail',
    true,
    jsonb_build_object(
        'smtp_host',       'smtp.gmail.com',
        'smtp_port',       '465',
        -- Implicit TLS: encrypted from the first byte. 587/STARTTLS opens in the
        -- clear and upgrades, which Gmail also accepts but is the weaker default.
        'encryption_type', 'SSL/TLS',
        'smtp_user',       'info@f2hfresh.com',
        'from_address',    'info@f2hfresh.com',
        'from_name',       'F2H Fresh'
    )
)
ON CONFLICT (category, config_key) DO UPDATE
SET name        = EXCLUDED.name,
    provider    = EXCLUDED.provider,
    is_active   = true,
    config_data = public.api_integrations_config.config_data || EXCLUDED.config_data,
    updated_at  = CURRENT_TIMESTAMP;

-- Only one email row may be active: MailService takes the most recently updated
-- active row, so a stale second row would silently win after any edit.
UPDATE public.api_integrations_config
SET is_active  = false,
    updated_at = CURRENT_TIMESTAMP
WHERE category = 'email' AND config_key <> 'smtp';

-- ── Razorpay ────────────────────────────────────────────────────────────────
-- `public_api_key` is the browser-visible key id; the private key is a secret
-- and is written by the seeder, not here.
INSERT INTO public.api_integrations_config
    (category, config_key, name, provider, is_active, config_data)
VALUES (
    'payment-gateway',
    'razorpay',
    'Razorpay Payment Gateway',
    'razorpay',
    true,
    jsonb_build_object(
        'mode',           'test',
        'public_api_key', 'rzp_test_TPiH68pe3puSGV',
        'currency',       'INR',
        'company_name',   'F2H Fresh'
    )
)
ON CONFLICT (category, config_key) DO UPDATE
SET name        = EXCLUDED.name,
    provider    = EXCLUDED.provider,
    is_active   = true,
    config_data = public.api_integrations_config.config_data || EXCLUDED.config_data,
    updated_at  = CURRENT_TIMESTAMP;
