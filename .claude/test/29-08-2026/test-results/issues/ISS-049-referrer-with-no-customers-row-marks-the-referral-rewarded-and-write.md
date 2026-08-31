# ISS-049 — Referrer with no customers row marks the referral rewarded and writes an orphan ledger credit

| Field | Value |
|---|---|
| **Issue ID** | `ISS-049` |
| **Test Case ID(s)** | EDG-REF-A |
| **Module** | Referrals / Reward Engine |
| **Severity** | **High** |
| **Status** | Open |
| **Environment** | Live application, `f2h_fresh` database |
| **Detected** | 2026-08-31 (live real-time run) |

## Title

Referrer with no customers row marks the referral rewarded and writes an orphan ledger credit

## Steps to Reproduce

1. Insert a `pending` referral with `referrer_customer_id = 'APP_INVITE_GENERAL'` — the synthetic id
   `ReferralRepository.findByReferralCode()` returns for the codes `APP INVITE`, `INVITE`, `F2HREF`.
2. Call `ReferralRewardEngineService.processReferralReward(refereeId, orderId)`.
3. `SELECT * FROM customers WHERE customer_id = 'APP_INVITE_GENERAL';`
4. `SELECT * FROM customer_wallet_transactions WHERE customer_id = 'APP_INVITE_GENERAL';`

## Expected Result

The engine detects that the referrer owns no wallet, leaves the referral `pending` (or fails it
explicitly), and writes no ledger row.

## Actual Result

```
engine        : {"status":true,"referrer_type":"customer","referrer_reward":100,
                 "message":"Rewards processed: ₹100 credited to referrer wallet."}
customers row : DOES NOT EXIST — nothing was credited
ledger        : customer_id='APP_INVITE_GENERAL' amount=100.00 balance_after=100.00
                reference_type='referral_bonus'
referral      : status='rewarded', rewarded_at set
```

The ledger claims ₹100 was paid, no wallet moved, and because the referral is `rewarded` it can
never be retried. The referrer's reward is permanently lost and the books no longer reconcile.

## Root Cause

`referral-reward-engine.service.ts:158-168`:

```ts
const referrerUpdateRes = await client.query(
  `UPDATE customers SET wallet_balance = COALESCE(wallet_balance,0) + $1 ...
   WHERE customer_id = $2 RETURNING wallet_balance`, [amount, targetReferrerId]);
const referrerNewBalance = Number(referrerUpdateRes.rows?.[0]?.wallet_balance ?? referrerRewardAmount);
```

`rowCount` is never checked. When the UPDATE matches zero rows the `?? referrerRewardAmount`
fallback fabricates a plausible `balance_after` and the INSERT proceeds. `customer_wallet_transactions`
has no foreign key on `customer_id` — its only constraint is `PRIMARY KEY (id)` — so the orphan row
persists.

The same failure mode applies to any referrer id that resolves but has no `customers` row,
including the `USER_F2H*` phantoms from ISS-045.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/referral/services/referral-reward-engine.service.ts:157-186`
- `apps/api/src/panels/customer/referral/repositories/referral.repository.ts:64-74` (`APP_INVITE_GENERAL`)
- Tables: `customers`, `customer_wallet_transactions`

## Recommended Fix

1. Check `referrerUpdateRes.rowCount === 1` before writing the ledger row; otherwise `ROLLBACK` and
   return `{status:false, message:'Referrer wallet not found'}`, leaving the referral `pending`.
2. Never derive `balance_after` from a fallback — it must come from the `RETURNING` value.
3. Add `FOREIGN KEY (customer_id) REFERENCES customers(customer_id)` to
   `customer_wallet_transactions` so this class of orphan cannot be written at all.
4. Decide what `APP INVITE` should mean. If it is a non-attributable install source it must not
   enter the reward path.

## Regression Tests Required

- EDG-REF-A — non-existent referrer leaves the referral `pending` and writes no ledger row
- Ledger reconciliation: every `customer_wallet_transactions.customer_id` has a `customers` row
