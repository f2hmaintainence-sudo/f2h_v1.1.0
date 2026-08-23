-- ============================================================================
-- Migration 015: Delivery Partner Referral Payment Tracking
-- Adds columns for physical offline payment tracking to delivery_partner_referral_bonuses
-- ============================================================================

ALTER TABLE public.delivery_partner_referral_bonuses 
  ADD COLUMN IF NOT EXISTS paid_by VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100),
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2);

CREATE INDEX IF NOT EXISTS idx_dp_ref_bonus_paid_at 
  ON public.delivery_partner_referral_bonuses (paid_at);

CREATE INDEX IF NOT EXISTS idx_dp_ref_bonus_created_at 
  ON public.delivery_partner_referral_bonuses (created_at);
