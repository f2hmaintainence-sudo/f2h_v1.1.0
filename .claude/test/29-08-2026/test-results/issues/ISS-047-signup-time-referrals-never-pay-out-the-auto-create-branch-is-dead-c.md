# ISS-047 — Signup-time referrals never pay out: the auto-create branch is dead code

| Field | Value |
|---|---|
| **Issue ID** | `ISS-047` |
| **Test Case ID(s)** | REF-CUST-005 |
| **Module** | Referrals / Reward Engine |
| **Severity** | **Critical** |
| **Status** | Open (ISS-008 root cause #3, still unfixed) |
| **Environment** | Live application, `f2h_fresh` database |
| **Detected** | 2026-08-31 (live real-time run) |

## Title

Signup-time referrals never pay out: the auto-create branch is dead code

## Steps to Reproduce

1. Create customer `QAREFDHIY719` with `users.referred_by = 'F2HQFK7NH'` and **no** `referrals` row —
   the state produced by entering a referral code at signup.
2. Call `ReferralRewardEngineService.processReferralReward('QAREFDHIY719', 'QAORDHIY719D1')`.

## Expected Result

The engine's step 2b auto-creates the `referrals` row from `referred_by` and credits the referrer
₹100 (`F2HQFK7NH` 998.00 → 1098.00).

## Actual Result

```
engine   : {"status":false,"message":"No eligible referral record found or reward already processed."}
referrals: no row created for QAREFDHIY719
wallet   : F2HQFK7NH 998.00 -> 998.00   (no credit)
```

## Root Cause

The auto-create branch at `referral-reward-engine.service.ts:70` is gated on
`if (!referralRecord && referrerId)`, where

```ts
let referrerId = referee.referred_by || '';
```

`referee` comes from

```sql
SELECT c.*, u.first_name, u.last_name, u.user_name, u.phone, u.email
FROM customers c JOIN users u ON u.user_id = c.customer_id
WHERE c.customer_id = $1 OR u.email = $1 OR u.phone = $1
```

`referred_by` is a column on **`users`**, not `customers` — confirmed against
`information_schema.columns` (`customers` has only `customer_id`, `wallet_balance`,
`first_order_completed` among referral-related columns). It is not in the select list, so
`referee.referred_by` is always `undefined`, `referrerId` is always `''`, and the branch never runs.

This is exactly root cause #3 of ISS-008, which was reported on 2026-08-29 and not fixed.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/referral/services/referral-reward-engine.service.ts:37-42, 68-101`
- Tables: `users` (`referred_by`), `customers`, `referrals`

## Recommended Fix

Add `u.referred_by` to the referee select list:

```sql
SELECT c.*, u.first_name, u.last_name, u.user_name, u.phone, u.email, u.referred_by
```

Then re-verify the auto-create branch end to end, including the delivery-partner detection inside it.

## Regression Tests Required

- REF-CUST-005 — `users.referred_by` set with no `referrals` row → row auto-created and referrer credited
- Same for a delivery-partner referrer → ₹75 bonus row, not a wallet credit
