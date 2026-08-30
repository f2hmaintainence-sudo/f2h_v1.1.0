# ISS-006 — `POST /delivery/orders/run/:runId/start` always returns HTTP 500 — a run can never be started

| Field | Value |
|---|---|
| **Issue ID** | `ISS-006` |
| **Test Case ID(s)** | DP-RUN-001, E2E-001, E2E-004 |
| **Module** | Delivery Partner / Run Execution |
| **Severity** | **Critical** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

`POST /delivery/orders/run/:runId/start` always returns HTTP 500 — a run can never be started

## Steps to Reproduce

1. Authenticate as delivery partner `QA_DP_01`.
2. Ensure an assigned run exists (`RUN-20260830-MOR-002`, status `assigned`).
3. `POST /api/v1/delivery/orders/run/RUN-20260830-MOR-002/start`.

## Expected Result

Run transitions to `in_progress` with a start timestamp; all run orders move
`assigned/confirmed → out_for_delivery`; GPS streaming begins.

## Actual Result

HTTP 500 `{"statusCode":500,"message":"Internal server error"}`. Run status stays `assigned`;
no order changes state.

API error log:
```
errorCode: '42703', routine: 'transformUpdateTargetList', position: '50'
at <anonymous> (delivery.order.service.ts:954)
at DeliveryOrderService.startTodayRun (delivery.order.service.ts:953)
```

## Root Cause

`startTodayRun` executes:

```sql
UPDATE delivery_runs SET status = 'in_progress', started_at = NOW(), updated_at = NOW() WHERE id = $1
```

`delivery_runs` has no `started_at` column. Its time columns are `planned_start_time`,
`actual_start_time`, `actual_end_time`. PostgreSQL rejects the UPDATE target list with `42703`,
the surrounding `db.transaction` rolls back and the request 500s.

Existing production runs that show `in_progress` were moved there by a different code path
(`markOrdersOutForDelivery` / `markStopDelivered`), which is why the defect has not stopped all
deliveries — but the documented Start Run action is dead.

## Affected Files / API / Tables

- `apps/api/src/panels/delivery-partner/orders/services/delivery.order.service.ts:953-956` (`startTodayRun`)
- Table: `delivery_runs` (`actual_start_time`, not `started_at`)

## Recommended Fix

Use the real column:
```sql
UPDATE delivery_runs
   SET status = 'in_progress',
       actual_start_time = COALESCE(actual_start_time, NOW()),
       updated_at = NOW()
 WHERE id = $1
```
Add an integration test that starts a run against a real schema (the current unit tests clearly
do not exercise this statement).

## Regression Tests Required

- DP-RUN-001 (start run → `in_progress`, `actual_start_time` set, orders `out_for_delivery`)
- E2E-001 / E2E-004 full delivery journeys
- A schema-drift guard (CI check that every column referenced in SQL exists in the live schema)
