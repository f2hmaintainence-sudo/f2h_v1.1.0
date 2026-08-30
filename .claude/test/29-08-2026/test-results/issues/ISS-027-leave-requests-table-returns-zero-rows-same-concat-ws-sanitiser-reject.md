# ISS-027 — Leave Requests table returns zero rows — same `CONCAT_WS` sanitiser rejection as ISS-002

| Field | Value |
|---|---|
| **Issue ID** | `ISS-027` |
| **Test Case ID(s)** | ADM-DEL-003, DP-AUTH-003 |
| **Module** | Admin / Delivery Leave Requests |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Leave Requests table returns zero rows — same `CONCAT_WS` sanitiser rejection as ISS-002

## Steps to Reproduce

1. As ADMIN, `GET /api/v1/admin/delivery/leave-requests/table?limit=3`.

## Expected Result

Leave requests listed with the partner's name, so the admin can approve or reject them.

## Actual Result

HTTP 200 with `{"status":false,"data":[]}`.

Log: `{"table":"delivery_leave_requests","error":"Invalid column name: CONCAT_WS(' ', users.first_name, users.last_name)"}`.

## Root Cause

Identical to ISS-002: the `delivery_partner_name` column is declared as a bare `CONCAT_WS(...)` expression, which `DataService`'s SELECT sanitiser rejects because it only whitelists expressions starting with `(` or `COALESCE(`.

## Affected Files / API / Tables

- `apps/api/src/panels/admin/delivery/...` leave-requests table service
- `apps/api/src/shared/database/Data.service.ts:1615-1644`
- Table: `delivery_leave_requests`

## Recommended Fix

Fix with ISS-002 — either wrap in `COALESCE(...)` or extend the sanitiser's function allow-list. Note `GET /admin/delivery/leave-requests` (non-table variant) works, so the admin has a partial workaround.

## Regression Tests Required

- ADM-DEL-003 (approve leave → status `approved` + FCM notification)
- DP-AUTH-003 (partner submits leave → visible to admin)
