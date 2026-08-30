# ISS-012 — COD orders stay `payment_status = 'pending'` after delivery — cash collection is never recorded

| Field | Value |
|---|---|
| **Issue ID** | `ISS-012` |
| **Test Case ID(s)** | DP-RUN-003, E2E-001 |
| **Module** | Delivery / COD Settlement |
| **Severity** | **High** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

COD orders stay `payment_status = 'pending'` after delivery — cash collection is never recorded

## Steps to Reproduce

1. Place a COD order (`OrdMOCB3B10KA70`, ₹228, `payment_mode='cod'`, `payment_status='pending'`).
2. Deliver the stop:
   `PATCH /api/v1/delivery/orders/run/RUN-20260830-MOR-002/address/ADDRCUU7OT/deliver` with `{"status":"delivered"}`.
3. Read back `orders.status` and `orders.payment_status`.

## Expected Result

`orders.status='delivered'` **and** `orders.payment_status='paid'`, with the collected cash
recorded for the end-of-run cash handover.

## Actual Result

```
order_id           | status    | payment_status
OrdMOCB3B10KA70    | delivered | pending
```
The order is delivered but the ₹228 cash collection is never recorded against it. There is also no
cash-collected field captured on the stop and no cash total available for the hub handover
(E2E-001 step 10).

## Root Cause

`markStopDelivered` sets `orders.status = 'delivered'` and `delivered_at`, but does not transition
`payment_status` for `payment_mode = 'cod'`, and the delivery body has no `cod_collected` /
`cash_amount` field to record what the partner took. Consequently every delivered COD order stays
`pending`, understating collected revenue and leaving no reconciliation trail for cash.

## Affected Files / API / Tables

- `apps/api/src/panels/delivery-partner/orders/services/delivery.order.service.ts:990+` (`markStopDelivered`)
- `apps/api/src/panels/delivery-partner/orders/services/delivery.order.service.ts` — delivery request body normaliser (`normalizeDeliveryBody`)
- Tables: `orders`, `payment_transactions`

## Recommended Fix

In the delivery transaction, when the order's `payment_mode` is `cod` and the stop is marked
delivered, set `payment_status = 'paid'` and record the collected amount (a `cod_collected`
field on the request, defaulting to `orders.total_amount`, plus a `payment_transactions` row with
`method='cash'`). Expose the run's cash total in the handover payload so the hub supervisor can
reconcile it. Reject a delivery where the collected cash does not match the order total unless an
explicit short-collection reason is supplied.

## Regression Tests Required

- DP-RUN-003 (COD stop delivered → `payment_status='paid'`, cash recorded)
- E2E-001 (COD journey through to cash handover at the hub)
- Report test: delivered-revenue figures include COD orders
