# ISS-003 — Prepaid subscription refund scan returns HTTP 500 — no refund candidate has ever been produced

| Field | Value |
|---|---|
| **Issue ID** | `ISS-003` |
| **Test Case ID(s)** | SUB-RFD-001, SUB-RFD-002, RFD-SUB-001, E2E-005, E2E-006 |
| **Module** | Subscriptions / Prepaid Refund Engine |
| **Severity** | **Critical** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Prepaid subscription refund scan returns HTTP 500 — no refund candidate has ever been produced

## Steps to Reproduce

1. Authenticate as ADMIN.
2. `GET /api/v1/subscriptions/refund-candidates/scan/preview?month=2026-09&customer_id=QA_CUST_PRE`
3. `GET /api/v1/subscriptions/refund-candidates/scan/preview?month=2026-08`
4. `POST /api/v1/subscriptions/refund-candidates/scan` `{"month":"2026-09","customer_id":"QA_CUST_PRE"}`
5. `SELECT COUNT(*) FROM subscription_refund_candidates;`

## Expected Result

The scan finds paused days and failed subscription deliveries, values each line at
`subscription_items.final_price`, and upserts rows into `subscription_refund_candidates`
keyed on `(subscription_item_id, scheduled_date, delivery_slot)`. Re-running skips existing rows.

## Actual Result

All three calls return `{"statusCode":500,"message":"Internal server error"}`.

`SELECT COUNT(*) FROM subscription_refund_candidates` returns **0** — across the whole production
database no refund candidate has ever been created, therefore no prepaid refund has ever been
reviewed or paid.

API error log:
```
error: column dra.order_id does not exist
  hint: 'Perhaps you meant to reference the column "dra.order_ids".'
  at RefundEligibilityService.findFailedOrders (refund-eligibility.service.ts:261)
  at RefundEligibilityService.preview (refund-eligibility.service.ts:350)
```

## Root Cause

`RefundEligibilityService.findFailedOrders()` joins `delivery_run_addresses` (aliased `dra`) on
`dra.order_id`. That column does not exist — the table stores a JSON array in `order_ids`:

`delivery_run_addresses(id, run_id, customer_id, address_id, sequence_no, delivery_status,
order_ids, delivered_at, ...)`

The query aborts with `42703`, `preview()` runs it inside `Promise.all`, so both the preview and
the writing `scan()` path fail before anything is materialised.

A second, independent defect makes the amount unusable even after the column is fixed: the same
query computes `ROUND(oi.quantity * si.final_price, 2) AS refund_amount`, and
`subscription_items.final_price` is never populated by the customer checkout path (see ISS-004),
so `refund_amount` would evaluate to `NULL`.

## Affected Files / API / Tables

- `apps/api/src/panels/admin/customers-orders/subscriptions/refund-candidates/refund-eligibility.service.ts:261` (`findFailedOrders`), `:350` (`preview`)
- Tables: `delivery_run_addresses` (`order_ids`), `subscription_refund_candidates`, `subscription_items`

## Recommended Fix

Match the stop to the order through the JSON array, e.g.
`AND dra.order_ids @> to_jsonb(ARRAY[o.order_id])` (or `EXISTS (SELECT 1 FROM jsonb_array_elements_text(dra.order_ids) x WHERE x = o.order_id)`),
and add a GIN index on `delivery_run_addresses.order_ids` if the scan is run over wide ranges.

Fix ISS-004 in the same change, and make `refund_amount` fall back to
`COALESCE(si.final_price, si.unit_price - si.discount_amount - si.coupon_amount)` so a legacy
row with a NULL `final_price` still values correctly.

## Regression Tests Required

- SUB-RFD-001 (3 paused days + 1 failed order → 4 candidates at the subscribed `final_price`, current catalog price ignored)
- SUB-RFD-002 (admin approval credits the wallet and marks candidates refunded)
- Idempotency: re-running `scanMonth` yields `created=0, skipped_existing=n`
- E2E-005 (paused days → month-end refund → wallet credit)
- E2E-006 (failed delivery → refund candidate → admin approval → wallet credit)
