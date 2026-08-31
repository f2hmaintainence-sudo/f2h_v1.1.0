# ISS-048 — POST /customer/referrals/add writes nothing and returns success

| Field | Value |
|---|---|
| **Issue ID** | `ISS-048` |
| **Test Case ID(s)** | REF-CUST-006, REF-CUST-004 |
| **Module** | Referrals / Customer |
| **Severity** | **Critical** |
| **Status** | Open (ISS-008 root cause #1, still unfixed) |
| **Environment** | Live application, `f2h_fresh` database |
| **Detected** | 2026-08-31 (live real-time run) |

## Title

POST /customer/referrals/add writes nothing and returns success

## Steps to Reproduce

1. As customer `QAREFFHIY719`, call
   `ReferralService.createReferral('QAREFFHIY719', { referral_code: 'F2HQFK7NH', referee_name: 'QA Referee F', referee_phone: '9000000006' })`
   (the code path behind `POST /api/v1/customer/referrals/add`).
2. `SELECT * FROM referrals WHERE referred_customer_id = 'QAREFFHIY719';`
3. `SELECT referred_by FROM users WHERE user_id = 'QAREFFHIY719';`
4. `tail apps/api/logs/app.log`

## Expected Result

A row with `referrer_customer_id = 'F2HQFK7NH'`, `referred_customer_id = 'QAREFFHIY719'`,
`status = 'pending'`, `referrer_reward_amount = 100.00`, and `users.referred_by = 'F2HQFK7NH'`.

## Actual Result

```
API response      : {"status":true,"message":"Referral recorded successfully","data":null}
referrals         : no row
users.referred_by : NULL

apps/api/logs/app.log:99
ERROR : Database Error {"table":"referrals","errorCode":"23502",
  "error":"null value in column \"referred_customer_id\" of relation \"referrals\"
           violates not-null constraint"}
```

## Root Cause

`ReferralService.createReferral()` (`referral.service.ts:104-123`) is unchanged since ISS-008:

```ts
const newReferral = await this.referralRepository.createReferral({
  id: refId,
  referrer_id: userId,        // <- the CALLER, who entered someone else's code
  referee_name: dto.referee_name,
  referee_phone: dto.referee_phone,
  status: 'completed',        // <- bypasses the first-delivered-order gate
  reward_amount: 100.00,
  ...
});
```

Three defects compound:

1. **Role inversion.** The authenticated caller is the *referee*, not the referrer.
2. **Missing NOT NULL column.** `referred_customer_id` is never supplied. `ReferralRepository.createReferral`
   maps `data.referred_customer_id || data.referee_id` → both undefined → `23502` on every call.
3. **Swallowed failure.** `DataService.insert` logs and returns falsy; the service returns
   `{status: true, message: 'Referral recorded successfully'}` regardless (see ISS-041).

`users.referred_by` is never written at all.

**Related — self-referral (REF-CUST-004).** `createReferral()` never calls `validateReferralCode()`.
Posting your own code returns `{"status":true,"message":"Referral recorded successfully"}`. No
self-referral row exists today only because the same `23502` kills every insert. Fixing this issue
without adding an explicit guard will open that hole.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/referral/services/referral.service.ts:104-123`
- `apps/api/src/panels/customer/referral/repositories/referral.repository.ts:174-195`
- `apps/api/src/panels/customer/referral/referral.controller.ts:84-93`
- Tables: `referrals`, `users`

## Recommended Fix

1. Treat the authenticated caller as the **referee**: resolve the submitted code to its owner and
   write `referrer_customer_id = <code owner>`, `referred_customer_id = userId`, `status = 'pending'`,
   `referrer_reward_amount = 100.00` (75.00 if the owner is a delivery partner).
2. Set `users.referred_by` in the same transaction.
3. Reject explicitly, with a real HTTP error: self-referral; a referee that already has a referral
   row; a referee whose `first_order_completed` is already true.
4. Stop swallowing insert failures — propagate them (ISS-041).

## Regression Tests Required

- REF-CUST-006 — row written with correct roles, `users.referred_by` set
- REF-CUST-004 — self-referral rejected with an error response, not a silent no-op
- Duplicate submission by the same referee rejected
