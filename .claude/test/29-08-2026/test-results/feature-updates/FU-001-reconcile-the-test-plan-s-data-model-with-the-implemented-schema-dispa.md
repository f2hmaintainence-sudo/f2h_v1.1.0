# FU-001 — Reconcile the test plan's data model with the implemented schema (dispatch, vendors, forecasts)

| Field | Value |
|---|---|
| **Feature/Update ID** | `FU-001` |
| **Related Test Case(s)** | DP-DISP-001, DP-DISP-002, DSP-REQ-001, DSP-BAL-001, DSP-HND-001, WH-STK-001, WH-STK-002, WH-FOR-001, E2E-010 |
| **Status** | Documented — not implemented |
| **Raised** | 2026-08-29 |

## Current Behaviour

The test specifications in `07-delivery-dispatch.md` and `08-inventory-warehouse.md` assert against
tables that do not exist in the live `f2h_fresh` database:

| Referenced by test plan | Exists in live schema? | What the implementation actually uses |
|---|---|---|
| `dispatch_requirements` | No | `delivery_dispatch` (header) |
| `dispatch_balances` | No | `delivery_dispatch_items` (`planned_qty`, `loaded_qty`, `delivered_qty`, `returned_qty`, `damaged_qty`, `extra_sold_qty`) |
| `container_transactions` | No | `customer_container_balances` + `delivery_container_reconciliation` |
| `vendors` | No | — (nothing; `purchase_entries.vendor_id` is an orphan integer column) |
| `vendor_intakes` | No | — (queried by the Intake screen, which therefore always fails — ISS-025) |
| `consumption_forecasts` | No | — (no forecast persistence found) |

Some verification points are also written against columns that do not exist
(`product_variants.is_out_of_stock` — the flag lives on `products` and `stock_balances`;
`containers.is_active` — the column is `status`; `coupons.discount_type` / `discount_value` /
`min_order_amount` — those live on `promotions`).

## Required Behaviour

One authoritative data model. Either the missing tables are implemented, or the test plan is
rewritten against the tables that exist. Until this is settled, roughly a dozen dispatch and
inventory test cases cannot be executed as written, and it is impossible to tell a genuine defect
from a documentation drift.

## Exact Implementation Requirement

1. Hold a short design review over the six missing tables and decide, per table, *implement* or
   *retire from the plan*.
2. For **retire**: rewrite the affected verification points in `07-delivery-dispatch.md` and
   `08-inventory-warehouse.md` to assert against `delivery_dispatch`, `delivery_dispatch_items`,
   `customer_container_balances`, `delivery_container_reconciliation` and `warehouse_containers`,
   using the real column names. Correct the column-level errors listed above.
3. For **implement** (recommended for `vendors` / `vendor_intakes`, since the Intake screen and
   `purchase_entries.vendor_id` already assume them): write one reviewed migration adding the
   tables with proper identity columns and foreign keys, and wire `purchase_entries.vendor_id` to
   `vendors`. Note the live `schema_migrations` table is unbaselined — apply the migration
   individually, not via a bulk replay.
4. Add a CI check that every table and column referenced in application SQL exists in the target
   schema; this run found nine separate defects caused by schema drift
   (ISS-001, ISS-003, ISS-006, ISS-007, ISS-018, ISS-019, ISS-021, ISS-022, ISS-023).

## Affected Modules / Files

- `.claude/test/29-08-2026/test-plan/07-delivery-dispatch.md`, `08-inventory-warehouse.md`, `13-test-data-requirements.md`
- `apps/api/src/panels/admin/catalog-inventory/warehouse/**` (intake)
- `apps/api/src/panels/admin/delivery/**` (dispatch)
- `apps/api/migrations/`

## Database / API Impact

Database: potentially new tables `vendors`, `vendor_intakes` (+ FK from `purchase_entries`);
no change to existing data if the *retire* path is chosen.
API: the Vendor Intake endpoints either start working or are removed.

## Acceptance Criteria

- Every table and column named in the test plan's verification points exists in `f2h_fresh`.
- `GET /admin/warehouses/intake/table` returns 200 with data, or the endpoint and its UI entry point are removed.
- The dispatch test cases (DSP-REQ-001, DSP-BAL-001, DSP-HND-001) are executable end to end against real tables.
- CI fails on any SQL referencing a non-existent column.

## Required Regression Tests

- Full re-run of `07-delivery-dispatch.md` and `08-inventory-warehouse.md`
- E2E-010 and E2E-011
