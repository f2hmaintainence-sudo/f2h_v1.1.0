-- ============================================================================
-- ChronoSparkSolutions — A Software Company
-- © 2026 ChronoSparkSolutions. All rights reserved.
--
-- Project     : F2H Fresh
-- File        : 003-razorpay-payment-gateway.sql
-- Description : Razorpay payment gateway — transaction ledger + gateway config
-- ============================================================================

-- ── Payment transaction ledger (provider agnostic, Razorpay first) ──────────
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id                  uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id      character varying(40) NOT NULL,
    customer_id         character varying(30) NOT NULL,
    purpose             character varying(30) NOT NULL,
    reference_id        character varying(50),
    provider            character varying(30) DEFAULT 'razorpay' NOT NULL,
    provider_order_id   character varying(100),
    provider_payment_id character varying(100),
    provider_signature  character varying(255),
    method              character varying(30),
    amount              numeric(12,2) NOT NULL,
    currency            character varying(10) DEFAULT 'INR' NOT NULL,
    status              character varying(20) DEFAULT 'created' NOT NULL,
    failure_reason      text,
    notes               jsonb DEFAULT '{}'::jsonb,
    paid_at             timestamp with time zone,
    fulfilled_at        timestamp with time zone,
    refunded_amount     numeric(12,2) DEFAULT 0,
    created_at          timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at          timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at          timestamp without time zone,
    CONSTRAINT payment_transactions_pkey PRIMARY KEY (id),
    CONSTRAINT payment_transactions_txn_id_key UNIQUE (transaction_id),
    CONSTRAINT payment_transactions_purpose_chk
        CHECK (purpose IN ('wallet_topup', 'bill', 'order', 'subscription')),
    CONSTRAINT payment_transactions_status_chk
        CHECK (status IN ('created', 'paid', 'fulfilled', 'failed', 'refunded', 'expired'))
);

-- Provider order/payment ids must map to exactly one internal transaction so
-- that checkout-callback and webhook fulfilment can never double-credit.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_provider_order
    ON public.payment_transactions (provider_order_id)
    WHERE provider_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_provider_payment
    ON public.payment_transactions (provider_payment_id)
    WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_customer
    ON public.payment_transactions (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_status
    ON public.payment_transactions (status, purpose);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference
    ON public.payment_transactions (reference_id)
    WHERE reference_id IS NOT NULL;

-- ── Webhook event log (idempotency + audit trail) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
    id           uuid DEFAULT gen_random_uuid() NOT NULL,
    provider     character varying(30) DEFAULT 'razorpay' NOT NULL,
    event_id     character varying(120) NOT NULL,
    event_type   character varying(60) NOT NULL,
    payload      jsonb DEFAULT '{}'::jsonb,
    processed    boolean DEFAULT false,
    process_note text,
    created_at   timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payment_webhook_events_pkey PRIMARY KEY (id),
    CONSTRAINT payment_webhook_events_event_key UNIQUE (provider, event_id)
);

-- ── Razorpay gateway credentials (managed from Admin → API Integrations) ────
INSERT INTO public.api_integrations_config
    (category, config_key, name, provider, is_active, config_data)
VALUES (
    'payment-gateway',
    'razorpay',
    'Razorpay Payment Gateway',
    'Razorpay',
    true,
    jsonb_build_object(
        'mode', 'test',
        'public_api_key', 'rzp_test_TPiH68pe3puSGV',
        'private_api_key', 'y3Jsws5YfEcUKeQDpShSrOay',
        'merchant_id', '',
        'webhook_secret', '',
        'currency', 'INR',
        'theme_color', '#16A34A',
        'company_name', 'F2H Fresh',
        'company_description', 'Farm to Home — Fresh Everyday'
    )
)
ON CONFLICT (category, config_key) DO UPDATE
SET name        = EXCLUDED.name,
    provider    = EXCLUDED.provider,
    is_active   = true,
    config_data = public.api_integrations_config.config_data || EXCLUDED.config_data,
    updated_at  = CURRENT_TIMESTAMP;
