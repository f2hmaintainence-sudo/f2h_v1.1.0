# ISS-046 — Delivery partner is never notified of the ₹75 acquisition bonus

| Field | Value |
|---|---|
| **Issue ID** | `ISS-046` |
| **Test Case ID(s)** | REF-PART-002 |
| **Module** | Referrals / Partner Bonus |
| **Severity** | **High** |
| **Status** | Open |
| **Environment** | Live application, `f2h_fresh` database |
| **Detected** | 2026-08-31 (live real-time run) |

## Title

Delivery partner is never notified of the ₹75 acquisition bonus

## Steps to Reproduce

1. Seed a `pending` referral with `referrer_customer_id = 'F2HFUGZ6H'` (a row in `delivery_partners`).
2. Call `ReferralRewardEngineService.processReferralReward(refereeId, orderId)`.
3. `SELECT n.title FROM notifications n JOIN notification_recipients nr ON nr.notification_id = n.notification_id WHERE nr.user_id = 'F2HFUGZ6H' AND n.type = 'referral_bonus';`

## Expected Result

Per the sequence diagram in `09-referrals.md` §2:
`ENG->>REF: Send FCM Push: "🎉 ₹75 New Customer Acquisition Bonus Accrued!"`

## Actual Result

The ₹75 bonus row is created correctly
(`DPBTKNAG34573`, `partner_id=F2HFUGZ6H`, `amount=75.00`, `status=pending`), but no
`notifications` row exists for the partner. The customer-referrer path does send its push
(`🎉 Referral Bonus Received!`), so the asymmetry is visible in the same run.

## Root Cause

`referral-reward-engine.service.ts:220` wraps the only notification call in `if (!referrerIsDP)`:

```ts
if (!referrerIsDP) {
  this.sendNotificationSafe(targetReferrerId, '🎉 Referral Bonus Received!', ...);
}
```

There is no `else` branch. The partner accrues salary-affecting money silently.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/referral/services/referral-reward-engine.service.ts:219-226`
- Tables: `notifications`, `notification_recipients`, `delivery_partner_referral_bonuses`

## Recommended Fix

Add the partner branch after commit, mirroring the customer one:

```ts
this.sendNotificationSafe(
  targetReferrerId,
  '🎉 New Customer Acquisition Bonus!',
  `₹${referrerRewardAmount} bonus accrued — ${referee.first_name} completed their 1st delivered order.`,
);
```

## Regression Tests Required

- REF-PART-002 — partner receives a `referral_bonus` notification on accrual
