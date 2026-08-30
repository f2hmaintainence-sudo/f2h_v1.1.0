# ISS-034 — Self-referral is accepted on the write path even though the validate endpoint rejects it

| Field | Value |
|---|---|
| **Issue ID** | `ISS-034` |
| **Test Case ID(s)** | REF-CUST-003, EDG-REF-002 |
| **Module** | Referrals / Anti-Fraud |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Self-referral is accepted on the write path even though the validate endpoint rejects it

## Steps to Reproduce

1. As customer `QA_CUST_REF`, `GET /api/v1/customer/referrals/validate/QA_CUST_REF`.
2. `POST /api/v1/customer/referrals/add` `{"referral_code":"QA_CUST_REF","referee_name":"QA Referee","referee_phone":"9000900004"}`.

## Expected Result

Both reject the self-referral: *"You cannot refer your own account"*, and no `referrals` row is created.

## Actual Result

`validate` correctly returns `{"status":true,"valid":false,"message":"Self-referral is not allowed"}`.

`add` returns `{"status":true,"message":"Referral recorded successfully"}` — accepting the same code it just rejected. (No row is actually written, but only because of the unrelated NOT NULL failure in ISS-008; the guard itself is absent.)

## Root Cause

`ReferralService.validateCode()` contains the self-referral check:

```ts
if (userId && (referrer.referrer_id === userId || referrer.user_id === userId || referrer.customer_id === userId)) {
  return { status: true, valid: false, message: 'Self-referral is not allowed' };
}
```

`ReferralService.createReferral()` never calls it and performs no equivalent check — it goes straight to the insert. The guard lives only on the advisory path, not the authoritative one.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/referral/services/referral.service.ts:77-102` (`validateCode`)
- `apps/api/src/panels/customer/referral/services/referral.service.ts:104-123` (`createReferral`)
- Table: `referrals`

## Recommended Fix

Call the same validation from `createReferral` and reject on `valid === false`. Add a database backstop:
`ALTER TABLE referrals ADD CONSTRAINT chk_no_self_referral CHECK (referrer_customer_id <> referred_customer_id);`
Also block circular referrals (A→B then B→A) and re-referral of a customer who already has `first_order_completed = true`. Fix together with ISS-008.

## Regression Tests Required

- REF-CUST-003 (self-referral rejected on both endpoints)
- EDG-REF-002 (circular referral blocked)
- Constraint test: no path can insert `referrer_customer_id = referred_customer_id`
