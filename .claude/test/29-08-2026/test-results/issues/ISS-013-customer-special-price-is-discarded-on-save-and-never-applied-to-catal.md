# ISS-013 — Customer special price is discarded on save and never applied to catalog or checkout pricing

| Field | Value |
|---|---|
| **Issue ID** | `ISS-013` |
| **Test Case ID(s)** | ADM-CUST-003, CUST-CAT-002 |
| **Module** | Admin / Customer Special Prices |
| **Severity** | **High** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Customer special price is discarded on save and never applied to catalog or checkout pricing

## Steps to Reproduce

1. As ADMIN, `POST /api/v1/admin/customer/special-prices` with
   `{"customer_id":"QA_CUST_PRE","items":[{"variant_id":"VRT0NFGWE8WG","special_price":63.00,"discount_percent":10}]}`.
2. `SELECT * FROM customer_special_prices WHERE customer_id='QA_CUST_PRE';`
3. As that customer, `GET /api/v1/customer/products` and inspect the variant's prices.
4. `GET /api/v1/admin/customer/special-prices/table`.

## Expected Result

The row stores `special_price = 63.00` with `discount_percentage = 10`, and the customer sees
₹63.00 as the effective price with the ₹76/₹80 catalog price struck through.

## Actual Result

The submitted price is silently replaced by the variant's `subscription_price`:

```
customer_id  | product_variant_id | special_price | discount_percentage | discount
QA_CUST_PRE  | VRT0NFGWE8WG       | 72.00         | 0.00                | 0.00
```
(₹72 is `product_variants.subscription_price`; ₹63 was requested.)

The customer catalog then ignores it entirely:
```json
{"variant_id":"VRT0NFGWE8WG","price":76,"original_price":80,"subscription_price":72,
 "final_price":76,"final_subscription_price":72,"has_special_price":true}
```
`has_special_price` is `true` while `final_price` is still the standard ₹76. Checkout charges ₹76.
The admin table reports `discount: 0, overall_savings_pct: 10`, which matches neither figure.

## Root Cause

Two separate defects:
1. The save handler does not persist the submitted `special_price` / `discount_percent`; it writes
   the variant's `subscription_price` and zeroes the discount columns. Both the
   `POST /admin/customer/special-prices` and `POST /admin/customer/:id/special-prices` shapes
   behave identically, so it is in the shared write path, not request-shape mismatch.
2. The customer pricing service reports `has_special_price: true` but computes `final_price` from
   the catalog price without applying the special-price row, so a special price could not take
   effect for one-time purchases even if it were stored correctly.

## Affected Files / API / Tables

- `apps/api/src/panels/admin/customers/customers.controller.ts` (`@Post('special-prices')`, `@Post(':id/special-prices')`) and the backing service
- `apps/api/src/panels/customer/categories_products/ModuleServices/categories_products.service.ts` (pricing/`PricingService` special-price application)
- Table: `customer_special_prices` (`special_price`, `discount_percentage`, `discount`)

## Recommended Fix

1. Persist exactly what the admin submits: store `special_price`, and derive
   `discount_percentage` from `original_price` when only a price is given (or derive the price when
   only a percentage is given). Validate `0 < special_price <= original_price`.
2. In the customer pricing path, when an active `customer_special_prices` row exists for
   `(customer_id, product_variant_id)`, set `final_price` (and `final_subscription_price`) from it
   and keep `price`/`original_price` as the struck-through reference.
3. Apply the same resolution in cart, one-time checkout and subscription checkout so the price the
   customer is shown is the price charged (relates to ISS-010 and ISS-020).

## Regression Tests Required

- ADM-CUST-003 (multi-row tariff save; totals/savings computed correctly)
- CUST-CAT-002 (customer sees the special price with the MRP struck through)
- Checkout test: one-time order and subscription both charge the special price
- Negative test: `special_price` above `original_price` is rejected
