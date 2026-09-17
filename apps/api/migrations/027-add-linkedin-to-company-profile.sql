-- ============================================================================
-- Migration   : 027-add-linkedin-to-company-profile.sql
-- Target      : PostgreSQL (f2h_dev / f2h_fresh)
-- Created At  : 2026-09-17T17:29:00.000Z
--
-- Description : Adds nullable linkedin_url to company_profile for official LinkedIn
--               social media profile links across web and public endpoints.
-- ============================================================================

BEGIN;

ALTER TABLE public.company_profile
  ADD COLUMN IF NOT EXISTS linkedin_url text;

COMMIT;
