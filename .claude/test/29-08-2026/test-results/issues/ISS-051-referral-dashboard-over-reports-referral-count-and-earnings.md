# ISS-051 — Referral dashboard over-reports referral count and earnings

| Field | Value |
|---|---|
| **Issue ID** | `ISS-051` |
| **Test Case ID(s)** | REF-CUST-007 |
| **Module** | Referrals / Customer Dashboard |
| **Severity** | **Medium** |
| **Status** | Open |
| **Environment** | Live application, `f2h_fresh` database |
| **Detected** | 2026-08-31 (live real-time run) |

## Title

Referral dashboard over-reports referral count and earnings

## Steps to Reproduce

1. `GET /api/v1/customer/referrals/dashboard` as `F2HQFK7NH`.
2. Compare against `SELECT * FROM referrals WHERE referrer_customer_id = 'F2HQFK7NH';`

## Expected Result

`total_referrals` counts referrals this customer *made*; `total_earnings` sums what they were paid
*as a referrer*. For `F2HQFK7NH` at the time of the run: **3 rewarded referrals, ₹300**.

## Actual Result

```
total_referrals = 5
total_earnings  = 350
```

Both are inflated. The extra referral is `referrals.id = 1`, where this customer was the **referee**,
not the referrer. The extra ₹50 is the legacy `"Welcome Reward: First order completed using
referral code"` credit they received **as a referee** on 2026-08-31 07:08.

## Root Cause

Three separate contributors:

1. `ReferralRepository.findByReferrerId()` filters
   `WHERE r.referrer_customer_id = $1 OR r.referred_customer_id = $1` — it deliberately returns
   both sides of the relationship, but `getReferralDashboard` and `getReferralHistory` present the
   result as "referrals you made".
2. `getTotalEarnings()` sums every wallet credit where
   `reference_type LIKE '%referral%' OR remarks LIKE '%referral%'`, which sweeps in credits the
   customer received as a referee, and takes `Math.max` of that against the row-derived total.
3. `getReferralDashboard()` then applies
   `Math.max(list.length, Math.ceil(earnings / 100))` — so a ₹75 partner bonus or a ₹50 legacy
   credit rounds the displayed count upward again.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/referral/repositories/referral.repository.ts:15-56, 197-228`
- `apps/api/src/panels/customer/referral/services/referral.service.ts:15-57`
- Tables: `referrals`, `customer_wallet_transactions`

## Recommended Fix

1. Give the repository two explicit methods — `findAsReferrer()` and `findAsReferee()` — instead of
   one `OR` query the callers reinterpret.
2. Count `total_referrals` from `referrer_customer_id = $1` only, and report rewarded and pending
   separately.
3. Derive `total_earnings` from the `referrals` rows themselves (`SUM(referrer_reward_amount) WHERE
   status='rewarded'`), and drop the `Math.max` heuristics against the wallet.
4. Clean up the legacy ₹50 `"Welcome Reward"` row (`WTtkmbls3644`), which is a first-order cashback
   the current rules forbid.

## Regression Tests Required

- REF-CUST-007 — dashboard counts and earnings match `referrals` exactly
- A customer who was referred but has referred nobody reports `total_referrals = 0`
