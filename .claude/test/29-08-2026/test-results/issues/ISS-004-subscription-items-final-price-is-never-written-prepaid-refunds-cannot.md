# ISS-004 — `subscription_items.final_price` is never written — prepaid refunds cannot be valued

| Field | Value |
|---|---|
| **Issue ID** | `ISS-004` |
| **Test Case ID(s)** | SUB-CRT-001, SUB-RFD-001, CUST-SUB-001 |
| **Module** | Subscriptions / Item Pricing |
| **Severity** | **Critical** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

`subscription_items.final_price` is never written — prepaid refunds cannot be valued

## Steps to Reproduce

1. As a customer, `POST /api/v1/customer/subscriptions/checkout` with one item and a 7-day schedule.
2. `SELECT subscription_item_id, unit_price, final_price FROM subscription_items WHERE subscription_id = '<new id>';`
3. Repeat for a second subscription.
4. `SELECT COUNT(*) FILTER (WHERE final_price IS NULL) FROM subscription_items;`

## Expected Result

`subscription_items.final_price` holds the price the customer actually subscribed at
(`unit_price - discount_amount - coupon_amount`), because the refund engine and the month-end
audit value every refundable day at that column.

## Actual Result

`final_price` is `NULL` for every subscription created through the customer app.

Test evidence (both QA subscriptions):
```
subscription_item_id | unit_price | final_price
SBI_MTEAXM4S3128     | 72         | (null)
SBI_MTEB2QBNN2PZ     | 72         | (null)
```

Across the production table: 10 item rows, 5 with a value, **5 NULL** — and all 4 most recent
(created through the current customer checkout code path) are NULL.

## Root Cause

The INSERT in `SubscriptionsService.checkout` simply omits the column:

```sql
INSERT INTO subscription_items (
  subscription_item_id, subscription_id, product_variant_id, unit_price,
  discount_id, coupon_id, discount_amount, coupon_amount, status
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active')
```

There is no `final_price` in the column list and no `UPDATE` afterwards. The column has no
database default, so it stays NULL. Every downstream consumer that values a refundable day at
`si.final_price` therefore computes `NULL`.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/subscriptions/ModuleServices/subscriptions.service.ts:576-600` (item INSERT)
- Consumers: `refund-eligibility.service.ts` (`ROUND(oi.quantity * si.final_price, 2)`), `subscriptions.service.ts:753`
- Table: `subscription_items`

## Recommended Fix

Compute and persist the value server-side inside the same statement:

```sql
INSERT INTO subscription_items (..., final_price, status)
VALUES (..., $4::numeric - COALESCE($7,0)::numeric - COALESCE($8,0)::numeric, 'active')
```

Back-fill existing NULL rows with
`UPDATE subscription_items SET final_price = unit_price - COALESCE(discount_amount,0) - COALESCE(coupon_amount,0) WHERE final_price IS NULL;`
and add a `NOT NULL` constraint once the back-fill is verified. Note this must be combined with
ISS-010 — `unit_price` itself is currently taken from the client and must be resolved server-side
from the catalog first.

## Regression Tests Required

- SUB-CRT-001 (item row carries a non-null `final_price` equal to the subscribed price)
- SUB-RFD-001 (refund valued at the subscribed `final_price`, not the current catalog price)
- Data migration test: no NULL `final_price` remains after back-fill
