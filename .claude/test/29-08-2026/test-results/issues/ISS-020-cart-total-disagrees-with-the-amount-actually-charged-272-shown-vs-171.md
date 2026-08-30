# ISS-020 — Cart total disagrees with the amount actually charged (₹272 shown vs ₹171 charged)

| Field | Value |
|---|---|
| **Issue ID** | `ISS-020` |
| **Test Case ID(s)** | CUST-CART-001, CUST-ORD-001 |
| **Module** | Customer / Cart Bill Summary |
| **Severity** | **High** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Cart total disagrees with the amount actually charged (₹272 shown vs ₹171 charged)

## Steps to Reproduce

1. Add 2 × `Fresh cow milk -1L` (₹76) and 1 × `Fresh curd -1L` (₹95) via `POST /customer/cart-sync`.
2. `GET /api/v1/customer/cart-items` and read `billSummary`.
3. `POST /api/v1/customer/checkout/payment` with the same items and `payment_method: "wallet"`.
4. Compare the wallet debit and the persisted order.

## Expected Result

The cart's `grandTotal` equals the amount charged at checkout, with the same discounts and fees
applied on both sides.

## Actual Result

Cart preview:
```json
{"itemsSubtotal":247,"deliveryPartnerFee":0,"taxesAndHandling":25,"grandTotal":272}
```
Checkout result:
```json
{"total_amount":171,"discount_amount":76,
 "coupon_summary":{"subtotal":247,"promotion_discount":76,"total_discount":76,"final_amount":171}}
```
Wallet debited ₹171; `orders` stores `subtotal 247.00, discount_amount 76.00, gst_amount 0.00, total_amount 171.00`.

The customer is shown ₹272 and charged ₹171 — a ₹101 discrepancy in two directions at once:
the ₹76 auto-applied promotion is missing from the cart preview, and the ₹25 taxes-and-handling
fee from the cart is missing from the charge.

## Root Cause

`calculateBillSummary()` computes `itemsSubtotal` from raw `product_variants.price × quantity` and
adds `taxes_and_handling_fee` (25) and the delivery-fee rule from
`system_configurations.delivery_rules`. It never consults the promotion engine or
`customer_special_prices`.

The checkout path runs a different calculation: it applies auto-apply promotions
(`promotion_products` — `PROMO_FIRST_MILK` at 50% on the milk variant here) and produces
`final_amount`, but does **not** add `taxes_and_handling_fee`.

The two code paths therefore disagree in both directions, and neither is the single source of truth.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/cartAndCheckout/ModuleServices/cartAndCheckout.service.ts:160-210` (`calculateItemTotal`, `calculateBillSummary`)
- the checkout/`coupon_summary` computation in the same service
- `system_configurations.delivery_rules` (`taxes_and_handling_fee: 25`, `base_delivery_fee: 20`, `free_delivery_threshold: 250`)
- Tables: `promotions`, `promotion_products`, `customer_special_prices`, `orders`

## Recommended Fix

Extract one pricing function used by both the preview and the charge — same inputs
(customer, items, address, coupon), same output object (subtotal, promotion discount, coupon
discount, delivery fee, taxes/handling, grand total). Cart calls it in preview mode; checkout calls
it and persists the identical breakdown to `orders`. Add an assertion at checkout that the
recomputed total matches the previewed total for the same cart version, and surface every
component line in `billSummary` so the app can show the promotion.

This is also where `customer_special_prices` must be applied (ISS-013).

## Regression Tests Required

- CUST-CART-001 (cart summary lines and grand total)
- CUST-ORD-001 (charged amount equals previewed grand total)
- Promotion test: auto-apply promotion visible in the cart and reflected in the charge
- Fee test: taxes/handling and delivery fee applied consistently on both paths
- Special-price + promotion interaction test
