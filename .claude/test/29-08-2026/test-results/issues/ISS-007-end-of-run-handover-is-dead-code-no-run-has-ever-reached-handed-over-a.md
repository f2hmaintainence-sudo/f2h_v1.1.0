# ISS-007 — End-of-run handover is dead code — no run has ever reached `handed_over` and warehouse container stock is never restored

| Field | Value |
|---|---|
| **Issue ID** | `ISS-007` |
| **Test Case ID(s)** | DP-HND-001, DSP-HND-001, E2E-010, E2E-011 |
| **Module** | Delivery Partner / End-of-Run Handover & Container Reconciliation |
| **Severity** | **Critical** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

End-of-run handover is dead code — no run has ever reached `handed_over` and warehouse container stock is never restored

## Steps to Reproduce

1. Complete every stop on a run (run auto-transitions to `completed`).
2. `POST /api/v1/delivery/orders/run/RUN-20260830-MOR-002/handover`.
3. Read back `delivery_runs.status`, `delivery_container_reconciliation`, `warehouse_containers`.
4. `SELECT status, COUNT(*) FROM delivery_runs GROUP BY 1;`

## Expected Result

Run transitions `completed → handed_over` with `actual_end_time` set; collected empties are
submitted; `delivery_container_reconciliation.status` moves to reconciled; `warehouse_containers.quantity`
is incremented by the returned bottles; `delivery_dispatch.status` becomes `return_pending`.

## Actual Result

The API responds `{"success":true,"message":"Run already handed over","status":"handed_over","empty_bottles_returned":0,"returned_items":[]}`
on the very first call — but the database says otherwise:

```
run_id                 | status    | actual_end_time
RUN-20260830-MOR-002   | completed | 2026-08-29 13:53:28+02

delivery_container_reconciliation: collected_quantity=5, submitted_quantity=0,
                                   discrepancy_quantity=5, status='pending'
warehouse_containers (WH-MTEBESZ953A8S7, CONT-001): quantity = 0
```

Across the whole production database:
`SELECT status, COUNT(*) FROM delivery_runs GROUP BY 1` → `assigned 29, completed 11, in_progress 17`.
**Not one run in the system has ever reached `handed_over`.**

## Root Cause

`handoverRun()` guards itself with `isRunHandedOver()`, which is implemented as:

```ts
`SELECT 1 FROM delivery_runs WHERE (run_id = $1 OR id::text = $1) AND status = 'completed' LIMIT 1`
```

It treats `completed` as meaning "already handed over". But `markStopDelivered()` sets a run to
`completed` as soon as the last stop is delivered. Consequently every run is `completed` before
handover is attempted, the guard always matches, and `handoverRun()` returns early — the whole
body (reconciliation totals, run status update, dispatch update) never executes.

A second latent defect sits in the unreachable body: it updates
`delivery_runs SET ... empty_bottles_collected = $1`, and `delivery_runs` has no
`empty_bottles_collected` column. Fixing only the guard would turn this into a 500.

## Affected Files / API / Tables

- `apps/api/src/panels/delivery-partner/orders/services/delivery.order.service.ts:453-462` (`isRunHandedOver`)
- `apps/api/src/panels/delivery-partner/orders/services/delivery.order.service.ts:1254-1312` (`handoverRun`)
- `apps/api/src/panels/delivery-partner/orders/services/delivery.order.service.ts:800` (status display path)
- Tables: `delivery_runs`, `delivery_container_reconciliation`, `warehouse_containers`, `delivery_dispatch`

## Recommended Fix

1. Introduce a real `handed_over` state and test for it:
   `... AND status = 'handed_over'` in `isRunHandedOver`.
2. Add the missing column (`ALTER TABLE delivery_runs ADD COLUMN empty_bottles_collected integer NOT NULL DEFAULT 0`)
   or drop it from the UPDATE.
3. In the handover transaction, also set `delivery_container_reconciliation.submitted_quantity`,
   recompute `discrepancy_quantity`, move `status` to `reconciled`, and
   `UPDATE warehouse_containers SET quantity = quantity + <submitted>`.
4. Document the run state machine: `assigned → in_progress → completed → handed_over`.

## Regression Tests Required

- DP-HND-001 (handover closes the run, restores stock, reconciles containers)
- DSP-HND-001 (dispatched = delivered + returned + damaged, zero discrepancy)
- E2E-010 (buffer loading → returns → warehouse stock restoral)
- E2E-011 (glass bottle circulation reconciliation)
- Negative test: calling handover twice is idempotent and the second call is a genuine no-op
