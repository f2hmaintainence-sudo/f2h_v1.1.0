# ISS-025 — Vendor Intake table is backed by a table that does not exist (`vendor_intakes`)

| Field | Value |
|---|---|
| **Issue ID** | `ISS-025` |
| **Test Case ID(s)** | WH-STK-001 |
| **Module** | Admin / Vendor Intake |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Vendor Intake table is backed by a table that does not exist (`vendor_intakes`)

## Steps to Reproduce

1. As ADMIN, `GET /api/v1/admin/warehouses/intake/table?limit=3`.

## Expected Result

Vendor intake rows listed.

## Actual Result

HTTP 200 with `{"status":false,"data":[]}`.

Log: `{"table":"vendor_intakes","errorCode":"42P01","error":"relation \"vendor_intakes\" does not exist"}` (three times per request).

## Root Cause

The intake module queries `vendor_intakes`, which is absent from the live schema. The related `vendors` table is also absent, while `purchase_entries.vendor_id` still exists as an integer column (see ISS-019). Vendor procurement is only partially built.

## Affected Files / API / Tables

- `apps/api/src/panels/admin/catalog-inventory/warehouse/...` intake table service
- Missing tables: `vendor_intakes`, `vendors`

## Recommended Fix

Decide the scope: either implement the vendor module (create `vendors` and `vendor_intakes` with a migration and wire `purchase_entries.vendor_id` to it), or remove the Vendor Intake screen and its endpoints until it is built. Tracked as FU-001.

## Regression Tests Required

- WH-STK-001 (once intake exists, stock inward increments balances and movements)
- Endpoint smoke test after the decision
