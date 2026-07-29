-- Migration 080: Delivery partner referral bonus tracking table
-- Admin sees this table and includes the bonus in the partner's salary when processing payroll.
-- No wallet on delivery_partners; bonus is recorded here and paid manually.

CREATE TABLE IF NOT EXISTS delivery_partner_referral_bonuses (
  id             BIGSERIAL PRIMARY KEY,
  bonus_id       VARCHAR(30) UNIQUE NOT NULL,
  partner_id     VARCHAR(50) NOT NULL,          -- delivery_partners.delivery_partner_id
  refer_id       VARCHAR(30),                   -- referrals.refer_id (can be NULL for auto-created)
  referee_name   VARCHAR(150),
  referee_phone  VARCHAR(30),
  order_id       VARCHAR(30),
  amount         NUMERIC(10,2) NOT NULL DEFAULT 75.00,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'cancelled')),
  remarks        TEXT,
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dp_ref_bonus_partner ON delivery_partner_referral_bonuses(partner_id);
CREATE INDEX IF NOT EXISTS idx_dp_ref_bonus_status  ON delivery_partner_referral_bonuses(status);
