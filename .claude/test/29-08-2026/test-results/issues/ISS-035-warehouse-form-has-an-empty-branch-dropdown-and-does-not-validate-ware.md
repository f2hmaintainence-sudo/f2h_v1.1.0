# ISS-035 — Warehouse form has an empty Branch dropdown and does not validate `warehouse_type`

| Field | Value |
|---|---|
| **Issue ID** | `ISS-035` |
| **Test Case ID(s)** | ADM-WH-001 |
| **Module** | Admin / Warehouse Form |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Warehouse form has an empty Branch dropdown and does not validate `warehouse_type`

## Steps to Reproduce

1. As ADMIN, `GET /api/v1/admin/warehouses/showAdd` and inspect the `branch_id` and `warehouse_type` field metadata.
2. `POST /api/v1/admin/warehouses/saveAdd` with `"warehouse_type":"main"` (not in the declared option list).
3. Read back the stored row.

## Expected Result

The branch dropdown lists the active branches and the field is required (the test plan calls branch linking mandatory, to prevent orphan warehouses). `warehouse_type` accepts only its declared values.

## Actual Result

Form metadata:
```json
{"name":"branch_id","required":false,"options":[{"value":"","label":"Select Branch (Optional)"}]}
{"name":"warehouse_type","required":true,"options":[cold_storage, dry_storage, temperature_controlled, refrigerated, general]}
```
The branch dropdown contains **no branches at all**, so an admin using the UI cannot link a warehouse to a branch — every UI-created warehouse becomes an orphan.

Separately, `POST` with `"warehouse_type":"main"` returned HTTP 201 and stored `warehouse_type = 'main'`, a value outside the declared option set.

## Root Cause

Two defects: (1) `showAdd` does not populate the branch option list from `branches` — it emits only the placeholder; and it marks the field optional, contradicting the documented requirement. (2) `saveAdd` validates that `warehouse_type` is *present* but never validates it against the allowed set, so any string is persisted.

## Affected Files / API / Tables

- `apps/api/src/panels/admin/catalog-inventory/warehouse/warehouse.controller.ts` (`showAdd`, `saveAdd`)
- the backing warehouse form/service
- Table: `warehouses` (`branch_id`, `warehouse_type`)

## Recommended Fix

Populate `branch_id.options` from `SELECT branch_id, branch_name FROM branches WHERE is_active = true ORDER BY branch_name` and mark it required. Validate `warehouse_type` against the enum server-side (a DTO `@IsIn([...])`), and add a `CHECK` constraint or enum type on the column. Audit existing rows for out-of-set values.

## Regression Tests Required

- ADM-WH-001 (warehouse created with a mandatory branch link)
- Negative test: `warehouse_type` outside the allowed set is rejected with 400
- Negative test: missing `branch_id` is rejected
