# ISS-021 — `GET /admin/analytics/outstanding` returns HTTP 500

| Field | Value |
|---|---|
| **Issue ID** | `ISS-021` |
| **Test Case ID(s)** | ADM-ANL-001 |
| **Module** | Admin / Analytics |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

`GET /admin/analytics/outstanding` returns HTTP 500

## Steps to Reproduce

1. As ADMIN, `GET /api/v1/admin/analytics/outstanding`.

## Expected Result

Outstanding-balance analytics returned with per-customer breakdown.

## Actual Result

HTTP 500 `{"message":"Failed","error":"Internal Server Error","statusCode":500}`.

Log: `getOutstandingBalances error ... column c.first_name does not exist (42703)`.

## Root Cause

`AnalyticsService.getOutstandingBalances()` selects `c.first_name, c.last_name, c.phone` from `customers`. Those columns live on `users`, joined via `users.user_id = customers.customer_id`. Same root cause family as ISS-001.

## Affected Files / API / Tables

- `apps/api/src/panels/admin/analytics/analytics.service.ts:390`
- Tables: `customers`, `users`, `customer_bills`

## Recommended Fix

Join `users` and project `u.first_name, u.last_name, u.phone`.

## Regression Tests Required

- ADM-ANL-001
- Smoke test covering every `/admin/analytics/*` endpoint
