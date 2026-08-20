-- Keep Company Profile as the canonical source for public brand/contact data.
-- Additive and idempotent so it is safe for databases with existing profiles.

BEGIN;

ALTER TABLE public.company_profile
  ADD COLUMN IF NOT EXISTS secondary_phone varchar(20),
  ADD COLUMN IF NOT EXISTS whatsapp varchar(20),
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS youtube_url text;

CREATE TABLE IF NOT EXISTS public.site_settings (
  key        varchar(120) PRIMARY KEY,
  value      text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
