# ISS-040 — A stop can be delivered without a proof photo and without the run ever being started

| Field | Value |
|---|---|
| **Issue ID** | `ISS-040` |
| **Test Case ID(s)** | DP-RUN-003, DP-RUN-001 |
| **Module** | Delivery / Stop Delivery State Machine |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

A stop can be delivered without a proof photo and without the run ever being started

## Steps to Reproduce

1. Leave run `RUN-20260830-MOR-002` in status `assigned` (never started — see ISS-006).
2. `PATCH /api/v1/delivery/orders/run/RUN-20260830-MOR-002/address/ADDRCUU7OT/deliver` with `{"status":"delivered"}` and no proof image.
3. Read back `orders`, `delivery_run_addresses`, `delivery_runs`.

## Expected Result

The delivery is rejected until the run is in progress, and a proof photo is required before a stop can be completed (the documented flow is PhotoProof → CollectContainers → MarkDelivered).

## Actual Result

The delivery is accepted:
```
orders.status = delivered
delivery_run_addresses: delivery_status=delivered, delivered_at set, delivery_image = (empty)
delivery_runs: assigned -> completed  (skipping in_progress entirely)
```
No proof photo, no run start, and the run jumped straight from `assigned` to `completed`.

## Root Cause

`markStopDelivered` validates only that the run belongs to the partner and that orders exist at the stop. It does not assert the run is `in_progress`, and does not require `delivery_image` / a `delivery_proof_logs` entry. The run's completion is derived purely from stop counts.

This interacts with ISS-006 (start is broken, so nothing *can* be `in_progress`) and ISS-007 (auto-`completed` is what makes handover unreachable).

## Affected Files / API / Tables

- `apps/api/src/panels/delivery-partner/orders/services/delivery.order.service.ts:990+` (`markStopDelivered`)
- Tables: `delivery_runs`, `delivery_run_addresses`, `orders`, `delivery_proof_logs`

## Recommended Fix

Define and enforce the run state machine `assigned → in_progress → completed → handed_over`: reject a stop delivery unless the run is `in_progress`, and require a proof image (or an explicit, logged override reason) before marking a stop delivered. Write the `delivery_proof_logs` row in the same transaction. Fix alongside ISS-006 and ISS-007, which are the other two halves of this state machine.

## Regression Tests Required

- DP-RUN-001 → DP-RUN-003 → DP-HND-001 as an ordered sequence
- Negative test: delivering a stop on a not-started run is rejected
- Negative test: delivering without proof is rejected
- DP-RUN-004 (failed stop logs reason and photo)
