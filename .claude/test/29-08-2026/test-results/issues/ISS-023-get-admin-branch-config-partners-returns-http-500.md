# ISS-023 — `GET /admin/branch-config/partners` returns HTTP 500

| Field | Value |
|---|---|
| **Issue ID** | `ISS-023` |
| **Test Case ID(s)** | ADM-BR-001 |
| **Module** | Admin / Branch Configuration |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

`GET /admin/branch-config/partners` returns HTTP 500

## Steps to Reproduce

1. As ADMIN, `GET /api/v1/admin/branch-config/partners`.

## Expected Result

Partner-to-branch allocation list returned.

## Actual Result

HTTP 500 `{"message":"Failed to retrieve partner allocation",...}`.

Log: `column db.id does not exist ... hint: 'Perhaps you meant to reference the column "b.id"' (42703)`.

## Root Cause

`BranchConfigService.getPartnerAllocation()` uses alias `db.` for a column that belongs to the `b.` alias. The PostgreSQL hint names the correct alias.

## Affected Files / API / Tables

- `apps/api/src/panels/admin/branch-Management/branch-config.service.ts:156`

## Recommended Fix

Correct the alias to `b.id` (or alias the delivery-partner table as `db` consistently).

## Regression Tests Required

- Branch configuration screen loads partner allocations
- Smoke test for `/admin/branch-config/*`
