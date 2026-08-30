# ISS-016 — Dashboard revenue counts undelivered orders — total revenue overstated 13.9×

| Field | Value |
|---|---|
| **Issue ID** | `ISS-016` |
| **Test Case ID(s)** | ADM-DASH-001, ADM-ANL-001 |
| **Module** | Admin / Dashboard Revenue KPIs |
| **Severity** | **High** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Dashboard revenue counts undelivered orders — total revenue overstated 13.9×

## Steps to Reproduce

1. `GET /api/v1/admin/dashboard/kpis`.
2. Compare each revenue figure against SQL over `orders`.

## Expected Result

Revenue KPIs reflect realised revenue — delivered orders only — and exclude soft-deleted rows.

## Actual Result

API: `today_revenue: 581`, `total_revenue: 13254`, `revenue_30d: 13254`, `revenue_7d: 6436`.

Actual delivered revenue:
```
SELECT SUM(total_amount) FROM orders WHERE status='delivered' AND deleted_at IS NULL;  -->   956.00
today delivered:                                                                        -->   324.00
7-day delivered:                                                                        -->   758.00
```

Status breakdown showing what is being counted:
```
assigned         53   8523.00
cancelled        11    930.00
confirmed        15   1291.00
delivered        17    956.00
out_for_delivery 20   2257.00
placed            5    227.00
```
`13254 = 14184 − 930` — i.e. every non-cancelled order regardless of whether it was ever
delivered. Reported total revenue is **13.9× actual**. `revenue_30d` equals `total_revenue` because
all data is inside 30 days, masking the error further.

## Root Cause

`dashboard.service.ts` computes:

```sql
COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled'), 0) AS total_revenue,
... FILTER (WHERE status != 'cancelled' AND scheduled_date >= CURRENT_DATE - INTERVAL '30 days') AS revenue_30d,
... FILTER (WHERE status != 'cancelled' AND scheduled_date >= CURRENT_DATE - INTERVAL '7 days')  AS revenue_7d
```

Three problems: only `cancelled` is excluded (so `placed`, `confirmed`, `assigned`,
`out_for_delivery` and — unlike `today_revenue` — `failed` all count as revenue); there is no
`deleted_at IS NULL` filter; and `CURRENT_DATE` is evaluated in the PostgreSQL session timezone,
which is `Europe/Berlin` rather than `Asia/Kolkata` (see ISS-032).

## Affected Files / API / Tables

- `apps/api/src/panels/admin/dashboard/dashboard.service.ts:61` (`today_revenue`), `:67-79` (`overall_revenue` CTE)
- Table: `orders`

## Recommended Fix

Decide and document the metric. If "revenue" means realised revenue:

```sql
COALESCE(SUM(total_amount) FILTER (WHERE status = 'delivered'), 0) AS total_revenue
```
with `WHERE deleted_at IS NULL` on the `orders` scan and date bounds computed in
`Asia/Kolkata`. If the dashboard also wants a forward-looking figure, expose it as a separate,
clearly-labelled `pipeline_value` rather than folding it into revenue. Apply the same rule to
`/admin/analytics/revenue` and the exports so every surface agrees.

## Regression Tests Required

- ADM-DASH-001 (each KPI reconciles to its documented SQL)
- ADM-ANL-001 (analytics revenue matches the dashboard and the CSV/PDF exports)
- Boundary test around IST midnight (relates to ISS-032)
- Regression test asserting `failed` and soft-deleted orders are excluded
