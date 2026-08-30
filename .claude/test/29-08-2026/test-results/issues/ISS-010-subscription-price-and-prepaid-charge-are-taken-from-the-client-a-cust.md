# ISS-010 — Subscription price and prepaid charge are taken from the client — a customer can subscribe for ₹0

| Field | Value |
|---|---|
| **Issue ID** | `ISS-010` |
| **Test Case ID(s)** | SUB-CRT-001, CUST-SUB-001, EDG-RCE-002 |
| **Module** | Subscriptions / Checkout Pricing Integrity |
| **Severity** | **Critical** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Subscription price and prepaid charge are taken from the client — a customer can subscribe for ₹0

## Steps to Reproduce

1. As a customer, `POST /api/v1/customer/subscriptions/checkout` **omitting** `estimated_total`
   and `monthly_estimate`, with `payment_type: "prepaid"`, `payment_method: "wallet"`,
   one item (`VRT0NFGWE8WG`, catalog `subscription_price` = ₹72) and a full 7-day schedule.
2. Read back `subscriptions.monthly_estimate`, `customer_wallet_transactions`, `customer_bills`.
3. Repeat sending `estimated_total: 2160` and compare.

## Expected Result

The server derives the monthly estimate from the weekly schedule × the catalog price for that
customer (including any special price), debits the wallet by that amount, and records a matching
prepaid bill. Client-supplied amounts are ignored or validated against the computed figure.

## Actual Result

Run 1 (no amount sent) — subscription created and activated for free:
```
subscriptions:  SUB_MTEAXM4QC04R  payment_type=prepaid  status=active  monthly_estimate=$0.00
wallet txn:     debit 0.00, balance_after 2829.00, reference_id SUB_MTEAXM4QC04R
customer_bills: BILL_MTEAXM53 type=subscription payment_type=prepaid status=paid total_amount=0.00
```
Run 2 (`estimated_total: 2160`) — wallet debited exactly the client-supplied figure:
```
wallet txn: debit 2160.00, balance_after 669.00
subscriptions.monthly_estimate = $2,160.00
```

The amount charged is whatever the client says it is. `subscription_items.unit_price` is likewise
stored verbatim from the request body.

## Root Cause

`SubscriptionsService.checkout` reads the charge straight off the request:

```ts
const estimatedTotal = Number(body.estimated_total || 0);
...
if (walletBalance < estimatedTotal) { /* reject */ }
...
body.monthly_estimate ?? body.estimated_total ?? 0
```

and the item INSERT binds `item.unit_price || 0`. Nothing in the flow reads
`product_variants.subscription_price`, `product_variants.price` or `customer_special_prices`, and
nothing recomputes the estimate from `subscription_weekly_schedule`. The postpaid credit-limit
check (which does work) is also evaluated against the same client-controlled number, so it can be
bypassed by understating `monthly_estimate`.

Existing production data shows the effect of trusting the client: `SUB_MSIYKVBR1E89` has
`unit_price = 50` / `final_price = 20` for a variant whose catalog price is ₹76.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/subscriptions/ModuleServices/subscriptions.service.ts:63` (`estimatedTotal`)
- `:159-175` (prepaid wallet gate), `:208-225` (postpaid credit check), `:533-560` (subscription INSERT), `:576-600` (item INSERT)
- `apps/api/src/panels/customer/subscriptions/dto/subscription.dto.ts` (`estimated_total`, `monthly_estimate`, `unit_price` accepted from the client)
- Tables: `subscriptions`, `subscription_items`, `customer_wallet_transactions`, `customer_bills`

## Recommended Fix

Move pricing entirely server-side:
1. Resolve each item's price from `product_variants` (subscription price) with
   `customer_special_prices` applied, never from `body.unit_price`.
2. Compute `monthly_estimate` from the weekly schedule × resolved price × the number of matching
   days in the billing window, minus scheduled pauses.
3. Persist `subscription_items.final_price` from the resolved figure (see ISS-004).
4. Drop `estimated_total` / `monthly_estimate` / `unit_price` from the DTO, or keep them only as a
   client-side display hint and reject the request when they disagree with the server figure by
   more than a rounding tolerance.
5. Add an idempotency key on checkout so a rapid double submit cannot create two subscriptions
   (EDG-RCE-002).

## Regression Tests Required

- SUB-CRT-001 (server-computed estimate matches schedule × price; wallet debited that amount)
- Negative test: `estimated_total: 0` or a tampered `unit_price` is rejected, not honoured
- SUB-CRT-002 Test B (credit limit evaluated against the server-computed estimate)
- EDG-RCE-002 (5 rapid submissions create exactly one subscription and one debit)
- Special-price interaction test (ISS-013)
