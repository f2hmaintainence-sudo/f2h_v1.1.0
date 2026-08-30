# FU-007 — Platform hardening: fail-loud data access, timezone alignment, and schema-drift prevention

| Field | Value |
|---|---|
| **Feature/Update ID** | `FU-007` |
| **Related Test Case(s)** | ADM-CUST-001, CUST-ORD-003, CUST-REF-001, EDG-CAL-003, ADM-DASH-001 |
| **Status** | Documented — not implemented |
| **Raised** | 2026-08-29 |

## Current Behaviour

Three cross-cutting weaknesses caused or concealed most of the defects found in this run.

1. **Silent write failures.** `DataService` catches driver errors and returns `{status:false}`
   instead of throwing. Callers rarely check it, so a rolled-back transaction still returns a
   success payload — the direct cause of ISS-005 (cancel says "refunded", nothing happens),
   ISS-008 (referral says "recorded", no row) and ISS-002 (customer table returns an empty 200).
2. **Schema drift.** Nine separate production defects in this run are application SQL referencing
   columns or tables that do not exist: ISS-001, ISS-003, ISS-006, ISS-007, ISS-018, ISS-019,
   ISS-021, ISS-022, ISS-023. Nothing catches these before runtime.
3. **Timezone mismatch.** The PostgreSQL session timezone is `Europe/Berlin` while the business
   operates in IST. Bare `CURRENT_DATE` resolves to the previous Indian day between 00:00 and
   03:30 IST — the window that contains the 00:05 IST billing cron.

## Required Behaviour

Failures surface immediately and loudly; SQL that references a non-existent column fails the build,
not the customer; and every date comparison resolves against the Indian business day.

## Exact Implementation Requirement

1. **Fail loud, in stages.** (a) Make `insert`/`update`/`delete` throw inside
   `executeTransaction` so an aborted transaction produces a 5xx; (b) make `TableHelper` propagate
   `status:false` as an error response rather than a 200 with an empty array; (c) audit callers
   that currently depend on the soft-failure contract. Add an integration test that forces a
   constraint violation at each layer and asserts a non-2xx response.
2. **Schema-drift CI gate.** Add a build step that parses the SQL string literals in
   `apps/api/src/**` and validates every referenced table and column against the target schema
   (or, more robustly, run the suite against a schema-loaded test database and fail on `42703` /
   `42P01`). This alone would have caught nine of this run's defects.
3. **Timezone.** `ALTER DATABASE f2h_fresh SET timezone TO 'Asia/Kolkata';` and set the timezone on
   connect for **both** pg pools used by `apps/api`. Then audit every bare `CURRENT_DATE` /
   `now()::date` and make the intent explicit.
4. **Primary keys.** Attach identity/sequences to `role_assignments.id` and `purchase_entries.id`,
   then sweep the remaining tables for the same drift (ISS-033).
5. **Route uniqueness.** Fail startup on duplicate `method + path` registrations — this would have
   caught the shadowed `admin/customer` controller (ISS-036) and the unreachable baskets routes
   (ISS-028).

## Affected Modules / Files

- `apps/api/src/shared/database/Data.service.ts` (`:418-431`, `:689-701`, write helpers)
- `apps/api/src/helpers/TableHelper.ts` (`:423`, `:1195-1200`)
- `apps/api/src/shared/database/Database.service.ts` (pool configuration)
- CI configuration (`.github/workflows/`, `Jenkinsfile`)
- Schema: `role_assignments`, `purchase_entries`

## Database / API Impact

Database: session timezone change (affects every date-sensitive query — re-verify the dashboard
and billing period boundaries after applying); identity columns added.
API: error responses change from `200 {status:false}` to 5xx for genuine failures. Clients that
treat any 200 as success will need review — worth coordinating with the Flutter releases.

## Acceptance Criteria

- A deliberately failing write returns a non-2xx response and leaves no partial data.
- CI fails on a PR that references a non-existent column.
- `SHOW timezone` returns `Asia/Kolkata` on both pools; a 01:00 IST request reports the correct business day.
- Inserts that omit `id` succeed on every table.
- Application startup fails when two controllers claim the same route.

## Required Regression Tests

- ADM-CUST-001, CUST-ORD-003, CUST-REF-001 (the three silent-failure cases)
- EDG-CAL-001, EDG-CAL-002, EDG-CAL-003 (date boundaries)
- ADM-DASH-001 at 00:30 IST
- Full API smoke suite after the timezone change
