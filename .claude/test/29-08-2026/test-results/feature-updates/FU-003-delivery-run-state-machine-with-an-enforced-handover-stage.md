# FU-003 — Delivery-run state machine with an enforced handover stage

| Field | Value |
|---|---|
| **Feature/Update ID** | `FU-003` |
| **Related Test Case(s)** | DP-RUN-001, DP-RUN-003, DP-RUN-004, DP-HND-001, DSP-HND-001, E2E-010, E2E-011 |
| **Status** | Documented — not implemented |
| **Raised** | 2026-08-29 |

## Current Behaviour

There is no enforced run lifecycle. `POST /run/:runId/start` is dead (`delivery_runs.started_at`
does not exist — ISS-006); a stop can be delivered on a run that was never started and without a
proof photo (ISS-040); the run auto-jumps `assigned → completed` when the last stop is delivered;
and `handoverRun()` is unreachable because `isRunHandedOver()` tests for `status = 'completed'`
(ISS-007).

Consequence measured on live data: **0 of 57 runs have ever reached `handed_over`**, collected
empties are never submitted to the warehouse, `warehouse_containers` is never incremented, and
`delivery_container_reconciliation` rows stay `pending` with a standing discrepancy.

## Required Behaviour

An explicit, enforced state machine —
`assigned → in_progress → completed → handed_over` — with the handover stage actually performing
reconciliation and stock restoral.

## Exact Implementation Requirement

1. Add the missing column and use the real one:
   `ALTER TABLE delivery_runs ADD COLUMN empty_bottles_collected integer NOT NULL DEFAULT 0;`
   and change `startTodayRun` to set `actual_start_time` (not `started_at`).
2. Rewrite `isRunHandedOver()` to test `status = 'handed_over'`.
3. Guard `markStopDelivered`: reject unless the run is `in_progress`; require a proof image (or a
   logged explicit override) before completing a stop; write `delivery_proof_logs` in the same
   transaction.
4. Implement the handover transaction properly: total collected containers, set
   `delivery_container_reconciliation.submitted_quantity` and recompute `discrepancy_quantity`,
   move its `status` to `reconciled`, `UPDATE warehouse_containers SET quantity = quantity + submitted`,
   restore undelivered stock via `stock_movements` (`movement_type = 'return_from_run'`), set
   `delivery_dispatch.status = 'return_pending'`, and set the run to `handed_over` with
   `actual_end_time`.
5. Add the missing failed-stop endpoint (`PATCH /run/:runId/address/:addressId/fail`) that the test
   plan documents (DP-RUN-004) — today only the admin-side `zone/delivery/not-home` path exists.
6. Make the transitions idempotent so a repeated call is a genuine no-op, not a false success.

## Affected Modules / Files

- `apps/api/src/panels/delivery-partner/orders/services/delivery.order.service.ts` (`startTodayRun` `:953`, `markStopDelivered` `:990`, `isRunHandedOver` `:453`, `handoverRun` `:1254`)
- `apps/api/src/panels/delivery-partner/orders/controllers/delivery.order.controller.ts`
- Admin run views that render run status

## Database / API Impact

Database: new column `delivery_runs.empty_bottles_collected`; `delivery_runs.status` gains the
`handed_over` value; back-fill decision needed for the 11 `completed` and 17 stuck `in_progress`
runs.
API: new failed-stop endpoint; stricter validation on the deliver endpoint (a client that skips
the start step will now receive a 4xx).

## Acceptance Criteria

- Start → run `in_progress`, `actual_start_time` set, orders `out_for_delivery`.
- Delivering a stop on a non-started run is rejected.
- Delivering without proof is rejected (or the override is recorded).
- Handover moves the run to `handed_over`, increments `warehouse_containers`, restores undelivered stock and reconciles containers.
- `dispatched = delivered + returned + damaged` with zero discrepancy.
- A second handover call is a no-op and says so truthfully.

## Required Regression Tests

- DP-RUN-001 → DP-RUN-003 → DP-RUN-004 → DP-HND-001 as an ordered sequence
- DSP-HND-001, E2E-010, E2E-011
- Idempotency tests on start, deliver and handover
