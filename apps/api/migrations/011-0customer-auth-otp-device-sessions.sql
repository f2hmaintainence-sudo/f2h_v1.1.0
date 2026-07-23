CREATE TABLE IF NOT EXISTS auth_otp_challenges (
  id BIGSERIAL PRIMARY KEY,
  contact VARCHAR(255) NOT NULL,
  channel VARCHAR(10) NOT NULL CHECK (channel IN ('email', 'phone')),
  purpose VARCHAR(30) NOT NULL CHECK (purpose IN ('registration', 'forgot_password')),
  otp_hash VARCHAR(64) NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_otp_lookup
  ON auth_otp_challenges(contact, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS device_sessions (
  id UUID PRIMARY KEY,
  user_id VARCHAR(30) NOT NULL,
  refresh_jti UUID NOT NULL UNIQUE,
  refresh_token_hash VARCHAR(64) NOT NULL,
  device_id VARCHAR(255),
  fcm_token TEXT,
  ip_address VARCHAR(64),
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_sessions_user
  ON device_sessions(user_id, revoked_at, expires_at);
