# FU-004 — Single pricing source of truth across catalog, cart, checkout and special prices

| Field | Value |
|---|---|
| **Feature/Update ID** | `FU-004` |
| **Related Test Case(s)** | CUST-CAT-002, CUST-CART-001, CUST-ORD-001, ADM-CUST-003, EDG-PRC-001 |
| **Status** | Documented — not implemented |
| **Raised** | 2026-08-29 |

## Current Behaviour

Three independent price calculations disagree with each other:

- **Cart preview** (`calculateBillSummary`) uses raw `product_variants.price × qty` and adds
  `taxes_and_handling_fee`; it ignores promotions and special prices.
- **Checkout** applies auto-apply promotions but omits the handling fee.
- **Special prices** are stored wrong (the submitted price is replaced by `subscription_price`)
  and are never applied to `final_price` at all.

Measured: cart showed **₹272**, checkout charged **₹171** for the same basket (ISS-020); a special
price of ₹63 was saved as ₹72 and the customer was still quoted and charged ₹76 while the API
reported `has_special_price: true` (ISS-013).

## Required Behaviour

One pricing function, used by every surface, producing an itemised breakdown that the cart
displays and the checkout charges — with customer special prices, promotions, coupons, delivery fee
and taxes/handling all resolved in one place.

## Exact Implementation Requirement

1. Extract `PricingService.quote({ customerId, items, addressId, couponCode, mode }) -> Quote`
   returning per-line `{ variant_id, qty, list_price, special_price?, promotion_discount,
   coupon_discount, final_price, line_total }` plus order-level
   `{ subtotal, total_discount, delivery_fee, taxes_and_handling, grand_total }`.
2. Resolution order per line: `customer_special_prices` → variant price → promotion → coupon.
3. Cart calls it in preview mode; checkout calls it and persists the identical breakdown to
   `orders` / `order_items`; subscription checkout calls it through FU-002.
4. Fix the special-price write path to persist the submitted `special_price` and derive
   `discount_percentage` from `original_price`, with validation `0 < special_price <= original_price`.
5. At checkout, assert the recomputed grand total matches the previewed total for the same cart
   version; reject with a 409 and a fresh quote if it drifted (guards EDG-PRC-001, where a variant
   is deactivated mid-cart).
6. Return the full breakdown in `billSummary` so the app can display the promotion line that is
   currently invisible.

## Affected Modules / Files

- `apps/api/src/panels/customer/cartAndCheckout/ModuleServices/cartAndCheckout.service.ts` (`calculateItemTotal`, `calculateBillSummary`, checkout `coupon_summary`)
- `apps/api/src/panels/customer/categories_products/ModuleServices/categories_products.service.ts` (catalog `final_price`)
- `apps/api/src/panels/admin/customers/**` (special-price save)
- Customer Flutter app: cart summary and product card rendering

## Database / API Impact

Database: `customer_special_prices.special_price` / `discount_percentage` start holding the values
the admin entered — audit and correct the 3 existing rows.
API: `billSummary` gains promotion and special-price lines (additive); checkout may now return 409
on a stale quote.

## Acceptance Criteria

- Cart `grandTotal` equals the amount charged, for every combination of special price, promotion, coupon and fee.
- A special price of ₹63 is stored as ₹63 and both quoted and charged as ₹63.
- `has_special_price` is only true when `final_price` actually reflects it.
- A variant deactivated mid-cart is rejected at checkout with a clear message and no fallback price.
- Admin special-price totals (Total MRP / Total Special / Savings) reconcile to the stored rows.

## Required Regression Tests

- CUST-CART-001, CUST-ORD-001, CUST-CAT-002, ADM-CUST-003
- EDG-PRC-001, EDG-PRC-002
- Subscription pricing regression via FU-002
