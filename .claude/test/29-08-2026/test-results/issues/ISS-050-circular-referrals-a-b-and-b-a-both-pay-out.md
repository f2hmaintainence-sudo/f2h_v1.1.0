# ISS-050 — Circular referrals A→B and B→A both pay out

| Field | Value |
|---|---|
| **Issue ID** | `ISS-050` |
| **Test Case ID(s)** | EDG-REF-B |
| **Module** | Referrals / Anti-Fraud |
| **Severity** | **High** |
| **Status** | Open |
| **Environment** | Live application, `f2h_fresh` database |
| **Detected** | 2026-08-31 (live real-time run) |

## Title

Circular referrals A→B and B→A both pay out

## Steps to Reproduce

1. Create customers `QAEDGXHJ1MLM` and `QAEDGYHJ1MLM`, each with `wallet_balance = 0.00`.
2. Insert two `pending` referrals: X refers Y, and Y refers X.
3. Deliver a first order for each and call `processReferralReward()` for both.

## Expected Result

The second referral is rejected — a customer cannot be the referrer of the account that referred
them. At most one ₹100 reward is paid.

## Actual Result

```
Y's first order : {"status":true,"referrer_reward":100}   -> X credited ₹100
X's first order : {"status":true,"referrer_reward":100}   -> Y credited ₹100
balances        : QAEDGXHJ1MLM 100.00, QAEDGYHJ1MLM 100.00
```

Two colluding signups extract ₹200 from the growth budget with no order value beyond the two
minimum first orders. The pattern scales linearly with pairs of accounts.

## Root Cause

`ReferralRewardEngineService.processReferralReward()` validates only that the *referee* has no
already-rewarded referral. It never checks the inverse relationship — whether
`referrals` already contains a row where `referrer_customer_id = <this referee>` **and**
`referred_customer_id = <this referrer>`.

Nothing on the write path blocks it either: `ReferralService.createReferral()` performs no
relationship checks at all (ISS-048), and there is no unique or exclusion constraint on
`referrals` beyond the primary key on `id`.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/referral/services/referral-reward-engine.service.ts:52-66`
- `apps/api/src/panels/customer/referral/services/referral.service.ts:104-123`
- Table: `referrals`

## Recommended Fix

1. Reject at write time: when creating a referral, fail if a row already exists with the referrer
   and referee swapped.
2. Defend again in the engine before crediting — the write path is not the only way rows appear
   (the auto-create branch of ISS-047 will be another).
3. Add `UNIQUE (referred_customer_id) WHERE deleted_at IS NULL` so a customer can be referred once,
   and consider recording the signup device/IP to catch the wider self-dealing case.

## Regression Tests Required

- EDG-REF-B — reciprocal referral rejected, at most one payout
- A customer can hold only one referral as referee
