-- ============================================================================
-- Migration   : 031-push-notification-campaigns.sql
-- Target      : PostgreSQL (f2h_dev / f2h_fresh)
-- Created At  : 2026-09-25
-- Description : Create push_notification_campaigns table for admin-managed
--               marketing push notification campaigns with approval workflow.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.push_notification_campaigns (
  id                  BIGSERIAL PRIMARY KEY,
  campaign_id         TEXT        NOT NULL UNIQUE DEFAULT ('PNC-' || upper(substr(md5(random()::text), 1, 10))),
  title               TEXT        NOT NULL,
  body                TEXT        NOT NULL,
  image_url           TEXT,
  category            TEXT,
  target_audience     TEXT        NOT NULL DEFAULT 'all_customers',
  target_user_ids     TEXT[],
  schedule_type       TEXT        NOT NULL DEFAULT 'immediate',
  scheduled_at        TIMESTAMPTZ,
  data_payload        JSONB       DEFAULT '{}',
  status              TEXT        NOT NULL DEFAULT 'draft',
  approved_by         TEXT,
  approved_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  sent_at             TIMESTAMPTZ,
  sent_count          INT         DEFAULT 0,
  failed_count        INT         DEFAULT 0,
  created_by          TEXT        NOT NULL DEFAULT 'ADMIN',
  updated_by          TEXT        NOT NULL DEFAULT 'ADMIN',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pnc_status     ON public.push_notification_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_pnc_created_at ON public.push_notification_campaigns (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pnc_category   ON public.push_notification_campaigns (category);

GRANT ALL PRIVILEGES ON TABLE public.push_notification_campaigns TO f2h_user;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO f2h_user;
