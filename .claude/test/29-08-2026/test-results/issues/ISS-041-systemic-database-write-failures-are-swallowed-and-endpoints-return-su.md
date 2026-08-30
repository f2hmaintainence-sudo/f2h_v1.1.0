# ISS-041 — Systemic: database write failures are swallowed and endpoints return success on a rolled-back transaction

| Field | Value |
|---|---|
| **Issue ID** | `ISS-041` |
| **Test Case ID(s)** | CUST-ORD-003, ADM-CUST-001, CUST-REF-001 |
| **Module** | Platform / Data Access Layer |
| **Severity** | **High** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Systemic: database write failures are swallowed and endpoints return success on a rolled-back transaction

## Steps to Reproduce

1. Trigger any operation whose inner write fails — e.g. `POST /customer/orders/:id/cancel` (ISS-005) or `POST /customer/referrals/add` (ISS-008).
2. Compare the HTTP response with the resulting database state.
3. `GET /admin/customer/table` (ISS-002) for the read-side variant.

## Expected Result

A failed write aborts the request with a 5xx (or a meaningful 4xx); the client is never told an operation succeeded when it did not.

## Actual Result

Three independent confirmed cases in this run:

| Endpoint | Response | Reality |
|---|---|---|
| `POST /customer/orders/:id/cancel` | `201 {"status":true,"message":"Order cancelled successfully"}` | order still `placed`, no refund, transaction aborted |
| `POST /customer/referrals/add` | `201 {"status":true,"message":"Referral recorded successfully"}` | no `referrals` row (NOT NULL violation) |
| `GET /admin/customer/table` | `200 {"status":false,"data":[],"recordsTotal":"41"}` | query threw; 41 rows exist and are never shown |

In each case the error is written only to `apps/api/logs/app.log`.

## Root Cause

`DataService`'s query and write helpers catch driver errors and return a result object instead of throwing:

```ts
} catch (error: any) {
  this.Developer.error('Database Error (shared conn)', { table, errorCode: error?.code, error: error?.message });
  return { status: false, data: [], message: 'Database query failed', query: sql };
}
```

Callers almost never inspect `status`. Inside `executeTransaction`, the first failure aborts the PostgreSQL transaction (`25P02` on every subsequent statement) while the JavaScript continues to completion and returns its success payload. The result is that a whole class of defects presents as "the UI says it worked" rather than as an error, which is why several of them (ISS-002, ISS-005, ISS-008) have survived in production.

## Affected Files / API / Tables

- `apps/api/src/shared/database/Data.service.ts:418-431` (shared-connection catch)
- `apps/api/src/shared/database/Data.service.ts:689-701` (dynamic-query catch)
- `apps/api/src/helpers/TableHelper.ts:423` (`status: result?.status ?? true`) and `:1195-1200` (`errorResponse`)
- Every caller that ignores the returned `status` flag

## Recommended Fix

Make write helpers throw. `insert`/`update`/`delete` should raise on driver error so the enclosing transaction rejects and Nest's exception filter returns a 5xx — the read helpers can keep returning a result object, but `TableHelper` must propagate `status:false` as an error response rather than a 200 with an empty array.

Given the breadth, stage it: (1) throw from write helpers inside `executeTransaction` first, since that is where silent data loss occurs; (2) then convert read failures in `TableHelper` to 5xx; (3) then audit callers that currently rely on the soft-failure contract. Add an integration test asserting that a deliberately failing write produces a non-2xx response.

## Regression Tests Required

- CUST-ORD-003 (failed cancel returns an error, not success)
- CUST-REF-001 (failed referral insert returns an error)
- ADM-CUST-001 (failed table query returns 5xx, not an empty 200)
- A generic test: force a constraint violation in each layer and assert non-2xx
