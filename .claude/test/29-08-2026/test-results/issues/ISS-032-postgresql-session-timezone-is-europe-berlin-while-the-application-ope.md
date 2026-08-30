# ISS-032 — PostgreSQL session timezone is `Europe/Berlin` while the application operates in `Asia/Kolkata`

| Field | Value |
|---|---|
| **Issue ID** | `ISS-032` |
| **Test Case ID(s)** | EDG-CAL-003, ADM-DASH-001 |
| **Module** | Platform / Timezone Configuration |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

PostgreSQL session timezone is `Europe/Berlin` while the application operates in `Asia/Kolkata`

## Steps to Reproduce

1. `SHOW timezone;`
2. `SELECT now(), current_date, (now() AT TIME ZONE 'Asia/Kolkata') AS ist;`
3. Compare with the OS clock (`TZ=Asia/Kolkata date`).

## Expected Result

Date-sensitive SQL evaluates against the Indian business day.

## Actual Result

```
TimeZone      = Europe/Berlin
now()         = 2026-08-29 13:35:58+02
current_date  = 2026-08-29
ist           = 2026-08-29 17:05:58
```
The OS is IST; the database session is CEST (UTC+2). The two agree only outside the 00:00–03:30 IST window. Application code correctly formats dates with `Intl.DateTimeFormat(..., {timeZone:'Asia/Kolkata'})`, but raw SQL using `CURRENT_DATE` does not.

## Root Cause

The PostgreSQL server/session timezone was never set to `Asia/Kolkata`. Any SQL that uses `CURRENT_DATE`, `CURRENT_TIMESTAMP` or `now()::date` without an explicit `AT TIME ZONE 'Asia/Kolkata'` resolves to the previous Indian day between 00:00 and 03:30 IST.

Affected queries observed during this run include the dashboard KPI CTEs (`scheduled_date = $1` with `CURRENT_DATE` bounds, `CURRENT_DATE - INTERVAL '30 days'`) and the billing repository's overdue filter (which *does* correctly use `(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date` — so the codebase is inconsistent with itself).

The morning-slot snapshot cron runs at 20:30 IST and the billing cron at 00:05 IST — the latter sits inside the divergence window.

## Affected Files / API / Tables

- PostgreSQL cluster/database/role timezone setting
- `apps/api/src/panels/admin/dashboard/dashboard.service.ts` (`CURRENT_DATE` usage)
- `apps/api/src/panels/admin/customers-orders/customer-billing/repository/customer-billing.repository.ts:252` (correct usage, for contrast)

## Recommended Fix

Set the timezone at the database or connection-pool level:
`ALTER DATABASE f2h_fresh SET timezone TO 'Asia/Kolkata';`
or set `options=-c timezone=Asia/Kolkata` / `SET TIME ZONE` on pool connect (both pools — see the note about two pg pools in this codebase). Then audit every bare `CURRENT_DATE` / `now()::date` and make the intent explicit.

## Regression Tests Required

- EDG-CAL-003 (midnight IST slot transition, no day-shift)
- ADM-DASH-001 (today's KPIs correct at 00:30 IST)
- Monthly billing cron at 00:05 IST bills the correct period
- Snapshot cron generates orders for the correct IST date
