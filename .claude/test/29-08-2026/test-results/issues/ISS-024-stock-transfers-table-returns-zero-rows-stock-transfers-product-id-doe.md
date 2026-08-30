# ISS-024 — Stock Transfers table returns zero rows — `stock_transfers.product_id` does not exist

| Field | Value |
|---|---|
| **Issue ID** | `ISS-024` |
| **Test Case ID(s)** | WH-STK-002 |
| **Module** | Admin / Warehouse Stock Transfers |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Stock Transfers table returns zero rows — `stock_transfers.product_id` does not exist

## Steps to Reproduce

1. As ADMIN, `GET /api/v1/admin/warehouses/transfers/table?limit=3`.

## Expected Result

Transfer rows listed.

## Actual Result

HTTP 200 but `{"status":false,"data":[],...}`.

Log: `Database Error (shared conn) {"table":"stock_transfers","errorCode":"42703","error":"column stock_transfers.product_id does not exist"}`.

## Root Cause

The DataTable definition selects `stock_transfers.product_id`, a column that is not on the table. The query fails and `DataService` returns `{status:false, data:[]}` with HTTP 200 (see ISS-041).

## Affected Files / API / Tables

- `apps/api/src/panels/admin/catalog-inventory/warehouse/...` transfers table service
- Table: `stock_transfers`

## Recommended Fix

Point the column at the real key (`product_variant_id` / the variant join) after confirming the intended schema; add the column if inter-warehouse transfers are meant to be product-level.

## Regression Tests Required

- WH-STK-002 (transfer create → dispatch → receive, with both stock movements)
- Transfers table lists rows
