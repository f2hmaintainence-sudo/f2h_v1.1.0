-- ============================================================================
-- Migration   : 032-push-campaign-action-target.sql
-- Target      : PostgreSQL (f2h_dev / f2h_fresh)
-- Created At  : 2026-09-25
-- Description : Add action_type, action_value, target_category_id, and 
--               target_product_id to push_notification_campaigns table,
--               and ensure notifications table has data column for routing.
-- ============================================================================

ALTER TABLE public.push_notification_campaigns
  ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS action_value TEXT,
  ADD COLUMN IF NOT EXISTS target_category_id TEXT,
  ADD COLUMN IF NOT EXISTS target_product_id TEXT;

CREATE INDEX IF NOT EXISTS idx_pnc_action_type ON public.push_notification_campaigns (action_type);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
