# FU-005 — Referral engine rebuild — correct roles, real columns, and the ₹100 / ₹75 payout paths

| Field | Value |
|---|---|
| **Feature/Update ID** | `FU-005` |
| **Related Test Case(s)** | CUST-REF-001, CUST-REF-002, REF-CUST-001, REF-CUST-002, REF-CUST-003, REF-PART-001, DP-REF-001, EDG-REF-001, EDG-REF-002, E2E-003, E2E-009 |
| **Status** | Documented — not implemented |
| **Raised** | 2026-08-29 |

## Current Behaviour

The referral feature does not work at any stage (ISS-008, ISS-034):

- `createReferral` records the caller as the **referrer** instead of the referee, never sets the
  `NOT NULL` `referred_customer_id`, and marks the row `completed` with a reward immediately —
  bypassing the first-delivery gate. Every insert fails and the API still returns success.
- `processReferralReward` filters on `referred_user_id`, `referrer_user_id` and `referee_phone`,
  none of which exist on `referrals`.
- The referrer fallback reads `referee.referred_by`, which is never selected (it lives on `users`).
- `add` does not apply the self-referral check that `validate` already implements.

Live evidence: **0** `referral_bonus` wallet transactions, **0** rows in
`delivery_partner_referral_bonuses`, and 6 referral rows with `rewarded_at` set while `status` is
still `pending` — with `first_order_completed` flagged on the *referrer* rather than the referee.

## Required Behaviour

A working, idempotent referral engine: signup links referee to referrer; the referrer is paid ₹100
to their wallet (or ₹75 as a pending delivery-partner bonus) exactly once, on the referee's first
*delivered* order; and fraud paths (self, circular, repeat) are blocked.

## Exact Implementation Requirement

1. **Signup linkage.** Rewrite `createReferral` so the authenticated caller is the referee:
   `referrer_customer_id` = owner of the submitted code, `referred_customer_id` = caller,
   `status = 'pending'`, `referrer_reward_amount = 100.00`. Set `users.referred_by` in the same
   transaction. Reject self-referral (reuse `validateCode`), circular referral, an already-referred
   customer, and a customer with `first_order_completed = true`.
2. **Reward lookup.** Replace the reward-engine predicate with the real columns:
   `WHERE referred_customer_id = $1 AND status <> 'rewarded' AND rewarded_at IS NULL FOR UPDATE`.
3. **Referrer resolution.** Add `u.referred_by` to the referee select list.
4. **Payout.** On the referee's first delivered order, inside one transaction with row locks:
   set `status='rewarded'` **and** `rewarded_at` together; credit the referrer's wallet with
   `reference_type='referral_bonus'`; or, when the referrer is in `delivery_partners`, insert a
   ₹75 `delivery_partner_referral_bonuses` row with `status='pending'` and leave the wallet alone.
   Set `first_order_completed` on the **referee**.
5. **Constraints.** `CHECK (referrer_customer_id <> referred_customer_id)` and a unique index on
   `referred_customer_id` so a customer can only ever be referred once.
6. **Data repair.** Reconcile the 7 existing rows: clear `rewarded_at` where `status = 'pending'`,
   and correct the `first_order_completed` flags set on the wrong party.

## Affected Modules / Files

- `apps/api/src/panels/customer/referral/services/referral.service.ts` (`createReferral`, `validateCode`)
- `apps/api/src/panels/customer/referral/services/referral-reward-engine.service.ts` (`processReferralReward`)
- `apps/api/src/panels/customer/referral/services/first-order-detector.service.ts`
- `apps/api/src/panels/customer/referral/listeners/order-delivered.listener.ts`
- Callers: `apps/api/src/panels/delivery-partner/orders/services/delivery.order.service.ts:1239`, `:1618`
- Tables: `referrals`, `customers`, `users`, `customer_wallet_transactions`, `delivery_partner_referral_bonuses`, `notifications`

## Database / API Impact

Database: new CHECK + unique constraints on `referrals`; data repair on 7 existing rows and on
`customers.first_order_completed`.
API: `POST /customer/referrals/add` changes semantics (caller becomes the referee) and starts
returning real 4xx errors instead of a blanket success — the Flutter client needs a matching release.

## Acceptance Criteria

- Signup with a valid code creates one `referrals` row with the correct referrer/referee roles and `status='pending'`.
- The referee's first delivered order credits the referrer exactly ₹100 with `reference_type='referral_bonus'` and sends the FCM push.
- Re-delivering the same order, or delivering a second order, credits nothing further.
- A delivery-partner referrer receives a ₹75 `pending` bonus row; no customer wallet credit.
- Self-referral and circular referral are rejected on both `validate` and `add`.
- `first_order_completed` is set on the referee only.

## Required Regression Tests

- CUST-REF-001, CUST-REF-002, REF-CUST-001, REF-CUST-002, REF-CUST-003
- REF-PART-001, DP-REF-001, E2E-003, E2E-009
- EDG-REF-001 (idempotency under repeated delivery events), EDG-REF-002 (circular)
- Concurrency test: two simultaneous delivery events credit exactly once
