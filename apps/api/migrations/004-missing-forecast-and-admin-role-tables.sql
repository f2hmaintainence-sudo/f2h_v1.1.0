CREATE TABLE IF NOT EXISTS public.admin_roles (
  id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_name   VARCHAR(50)  NOT NULL UNIQUE,
  description TEXT         DEFAULT NULL,
  permissions JSONB        DEFAULT '[]'::jsonb,
  is_active   BOOLEAN      DEFAULT TRUE,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);
