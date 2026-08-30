# FU-002 — Server-side subscription pricing engine (monthly estimate, unit price, final price)

| Field | Value |
|---|---|
| **Feature/Update ID** | `FU-002` |
| **Related Test Case(s)** | SUB-CRT-001, SUB-CRT-002, CUST-SUB-001, SUB-RFD-001, EDG-RCE-002 |
| **Status** | Documented — not implemented |
| **Raised** | 2026-08-29 |

## Current Behaviour

`SubscriptionsService.checkout` takes the money figures straight from the request body:
`estimated_total` / `monthly_estimate` drive the wallet debit, the prepaid bill and the postpaid
credit-limit check, and `item.unit_price` is stored verbatim. Nothing reads
`product_variants.subscription_price` or `customer_special_prices`, and
`subscription_items.final_price` is never written at all.

Demonstrated in this run: omitting `estimated_total` produced an **active prepaid subscription with
a ₹0.00 wallet debit and a ₹0.00 'paid' bill** (ISS-010); `final_price` is NULL on every
subscription created through the customer app (ISS-004).

## Required Behaviour

The server is the sole authority on subscription pricing. It resolves each item's price from the
catalog (with any customer special price applied), computes the monthly estimate from the weekly
schedule and the billing window, persists `unit_price` and `final_price`, and charges exactly that
amount. Client-supplied amounts are either ignored or rejected when they disagree.

## Exact Implementation Requirement

1. Add a `SubscriptionPricingService` with a single entry point:
   `price(customerId, items[], startDate, endDate) -> { items: [{variant_id, unit_price, discount_amount, final_price}], monthly_estimate }`.
2. Resolve `unit_price` from `product_variants.subscription_price` (falling back to `price`),
   then apply `customer_special_prices` for that customer (see FU-004 / ISS-013).
3. `final_price = unit_price - discount_amount - coupon_amount`; persist it in the
   `subscription_items` INSERT (currently the column is omitted entirely).
4. `monthly_estimate = Σ over items Σ over days-in-window ((m_quantity + e_quantity) × final_price)`,
   honouring `subscription_weekly_schedule` and subtracting scheduled pauses.
5. Use the computed estimate for the wallet debit, the prepaid bill and the postpaid credit-limit
   check. Remove `estimated_total`, `monthly_estimate` and `unit_price` from the accepted DTO, or
   keep them as a display hint and reject on mismatch beyond a ±₹1 tolerance.
6. Add an idempotency key to the checkout endpoint so rapid repeat submissions create one
   subscription and one debit (EDG-RCE-002).
7. Back-fill: `UPDATE subscription_items SET final_price = unit_price - COALESCE(discount_amount,0) - COALESCE(coupon_amount,0) WHERE final_price IS NULL;`

## Affected Modules / Files

- `apps/api/src/panels/customer/subscriptions/ModuleServices/subscriptions.service.ts` (`checkout`, item INSERT at `:576-600`)
- `apps/api/src/panels/customer/subscriptions/dto/subscription.dto.ts`
- new `apps/api/src/panels/customer/subscriptions/services/subscription-pricing.service.ts`
- pricing/special-price service shared with the catalog

## Database / API Impact

Database: `subscription_items.final_price` becomes populated (and eventually `NOT NULL`);
back-fill required for 5 existing NULL rows. No new tables.
API: `POST /customer/subscriptions/checkout` stops honouring client-supplied money fields —
a breaking change for the Flutter clients, which must be released together.

## Acceptance Criteria

- A checkout omitting all money fields still debits the correct amount (never ₹0).
- A checkout sending a tampered `unit_price` or `estimated_total` is rejected or ignored.
- `subscription_items.final_price` is non-null and equals the charged per-unit price.
- `monthly_estimate` equals the schedule × price calculation for the billing window.
- The postpaid credit-limit check uses the server-computed figure.
- Five rapid identical submissions create exactly one subscription and one wallet debit.

## Required Regression Tests

- SUB-CRT-001, SUB-CRT-002, CUST-SUB-001
- SUB-RFD-001 (refund valued at the persisted `final_price`)
- EDG-RCE-002
- Full regression of the prepaid and postpaid subscription journeys (E2E-004 … E2E-007)
