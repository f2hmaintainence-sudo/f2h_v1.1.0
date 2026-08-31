# ISS-008 — Customer ₹100 and delivery-partner ₹75 referral rewards are entirely non-functional

| Field | Value |
|---|---|
| **Issue ID** | `ISS-008` |
| **Test Case ID(s)** | CUST-REF-001, CUST-REF-002, REF-CUST-001, REF-CUST-002, REF-PART-001, DP-REF-001, E2E-003, E2E-009 |
| **Module** | Referrals / Reward Engine |
| **Severity** | **Critical** |
| **Status** | **Partially fixed** — re-tested live 2026-08-31 |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

> **Re-test 2026-08-31 (live).** Root cause #2 is **fixed**: the reward engine now queries the real
> `referrals` columns and pays ₹100 to a customer referrer / ₹75 to a delivery-partner referrer with
> ₹0 to the referee, transactionally and idempotently. Verified end to end — see
> `../09-referrals-live-test-2026-08-31.md`.
>
> Root causes **#1, #3 and #4 remain unfixed** and are now tracked separately:
> **ISS-048** (`createReferral` role inversion + swallowed `23502`), **ISS-047**
> (`referred_by` missing from the referee select, auto-create branch dead),
> and the self-referral write path (covered in ISS-048). Five further defects were found in the
> same run: ISS-045, ISS-046, ISS-049, ISS-050, ISS-051.

## Title

Customer ₹100 and delivery-partner ₹75 referral rewards are entirely non-functional

## Steps to Reproduce

1. As customer `QA_CUST_REF`, `GET /api/v1/customer/referrals/validate/QA_CUST_PRE` → valid.
2. `POST /api/v1/customer/referrals/add` `{"referral_code":"QA_CUST_PRE","referee_name":"QA Referee","referee_phone":"9000900004"}`.
3. Read back `referrals` and `users.referred_by`.
4. `SELECT reference_type, COUNT(*) FROM customer_wallet_transactions GROUP BY 1;`
5. `SELECT COUNT(*) FROM delivery_partner_referral_bonuses;`

## Expected Result

A `referrals` row is created with `referrer_customer_id = 'QA_CUST_PRE'`,
`referred_customer_id = 'QA_CUST_REF'`, `status='pending'`, `referrer_reward_amount = 100.00`.
On the referee's first delivered order the referrer's wallet is credited ₹100 with
`reference_type='referral_bonus'`; a delivery-partner referrer instead gets a ₹75 row in
`delivery_partner_referral_bonuses`.

## Actual Result

`POST /customer/referrals/add` returns HTTP 201 `{"status":true,"message":"Referral recorded successfully","data":null}`
but **no row is created**: `referrals` is unchanged and `users.referred_by` stays NULL.

`apps/api/logs/app.log`:
`ERROR : Database Error {"table":"referrals","errorCode":"23502","error":"null value in column \"referred_customer_id\" of relation \"referrals\" violates not-null constraint"}`

Production-wide state confirms the reward has never fired:
```
customer_wallet_transactions reference_type: order 24, subscription 10, topup 33   -- no referral_bonus
delivery_partner_referral_bonuses: 0 rows
referrals: 7 rows, all status='pending' (6 of them with rewarded_at already set)
T_CR_* referrers: wallet_balance 0.00, first_order_completed = true   <-- flag set on the wrong party
```

## Root Cause

Three compounding defects:

1. **Role inversion + missing NOT NULL column.** `ReferralService.createReferral()` writes
   `referrer_id: userId` — it records the *caller* (who entered someone else's code) as the
   referrer — and never supplies `referred_customer_id`, which is `NOT NULL`. Every insert fails
   with `23502`. The failure is swallowed and success is returned (see ISS-041).
   It also sets `status: 'completed'` with `reward_amount: 100.00` immediately, bypassing the
   documented "reward on first delivered order" gate.

2. **Reward engine queries non-existent columns.** `ReferralRewardEngineService.processReferralReward()`
   locks the referral with
   `WHERE (referred_user_id = $1 OR referrer_user_id = $1 OR referred_customer_id = $1 OR referred_customer_id = $2 OR (referee_phone = $3 AND $3 != ''))`.
   `referrals` has none of `referred_user_id`, `referrer_user_id`, `referee_phone` — its columns are
   `refer_id, referrer_customer_id, referred_customer_id, referral_code, referrer_reward_amount,
   referred_reward_amount, status, rewarded_at, remarks, created_at, updated_at, deleted_at`.

3. **Referrer can never be resolved from the profile.** The fallback reads `referee.referred_by`,
   but the referee query is `SELECT c.*, u.first_name, u.last_name, u.user_name, u.phone, u.email
   FROM customers c JOIN users u ...` — `referred_by` lives on `users` and is not in the select
   list, so it is always `undefined`.

4. **Self-referral is not blocked on the write path.** `validate` correctly returns
   *"Self-referral is not allowed"*, but `add` never calls it: posting your own code returns
   `{"status":true,"message":"Referral recorded successfully"}` (see ISS-034).

## Affected Files / API / Tables

- `apps/api/src/panels/customer/referral/services/referral.service.ts:104-123` (`createReferral`)
- `apps/api/src/panels/customer/referral/services/referral-reward-engine.service.ts:26-113` (`processReferralReward`)
- `apps/api/src/panels/customer/referral/listeners/order-delivered.listener.ts`
- Callers: `delivery.order.service.ts:1239`, `:1618`
- Tables: `referrals`, `customers`, `users`, `customer_wallet_transactions`, `delivery_partner_referral_bonuses`

## Recommended Fix

1. Rewrite `createReferral` so the authenticated caller is the **referee**:
   `referrer_customer_id` = owner of the submitted code, `referred_customer_id` = `userId`,
   `status = 'pending'`, `referrer_reward_amount = 100.00`. Reject self-referral and reject a
   referee that already has a referral row or `first_order_completed = true`.
   Also set `users.referred_by` in the same transaction.
2. Rewrite the reward-engine lookup against the real columns:
   `WHERE referred_customer_id = $1 AND status <> 'rewarded' AND rewarded_at IS NULL FOR UPDATE`.
3. Add `u.referred_by` to the referee select list.
4. On success set `status='rewarded'` **and** `rewarded_at` together (production rows currently
   have `rewarded_at` set while `status` is still `pending`), credit the referrer's wallet with
   `reference_type='referral_bonus'`, and insert the ₹75 `delivery_partner_referral_bonuses` row
   when the referrer is a delivery partner.
5. Set `first_order_completed` on the **referee**, not the referrer.

## Regression Tests Required

- CUST-REF-001 / REF-CUST-001 (signup with code → pending referral row; first delivery → ₹100 credit)
- REF-CUST-002 / EDG-REF-001 (re-delivering the first order credits exactly once)
- REF-CUST-003 (self-referral rejected)
- EDG-REF-002 (circular referral A→B, B→A blocked)
- REF-PART-001 / DP-REF-001 (delivery-partner referrer gets ₹75 pending bonus, customer wallet untouched)
- E2E-003 and E2E-009
