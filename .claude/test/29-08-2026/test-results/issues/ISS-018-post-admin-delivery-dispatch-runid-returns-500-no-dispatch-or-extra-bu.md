# ISS-018 — `POST /admin/delivery/dispatch/:runId` returns 500 — no dispatch (or extra/buffer quantity) can be created

| Field | Value |
|---|---|
| **Issue ID** | `ISS-018` |
| **Test Case ID(s)** | DP-DISP-001, DP-DISP-002, DSP-REQ-001, DSP-BAL-001, E2E-010 |
| **Module** | Admin / Delivery Dispatch Creation |
| **Severity** | **High** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

`POST /admin/delivery/dispatch/:runId` returns 500 — no dispatch (or extra/buffer quantity) can be created

## Steps to Reproduce

1. Create a delivery run (`RUN-20260830-MOR-002`).
2. `POST /api/v1/admin/delivery/dispatch/RUN-20260830-MOR-002` with
   `{"warehouse_id":"WH-MTEBESZ953A8S7","items":[{"product_variant_id":"VRT0NFGWE8WG","planned_qty":3,"loaded_qty":5}]}`.
3. `GET /api/v1/admin/delivery/dispatch/RUN-20260830-MOR-002/items`.
4. As the partner, `GET /api/v1/delivery/orders/pickup-items`.

## Expected Result

A `delivery_dispatch` row is created for the run with `delivery_dispatch_items` carrying
`planned_qty = 3` and `loaded_qty = 5` (2 extra buffer units), and the partner's Pickup &
Inventory screen shows planned + extra.

## Actual Result

`POST` → HTTP 500 `{"message":"Failed to dispatch to delivery boy","error":"Internal Server Error","statusCode":500}`.
`GET .../items` → `{"status":true,"data":[],"message":"Run dispatch items fetched"}`.
`delivery_dispatch` has **0 rows** for the run, so the partner's pickup list is empty and the
handover has no dispatched baseline to reconcile against.

`apps/api/logs/app.log`:
`ERROR : dispatchToDeliveryPartner error {"error":{"message":"column p.product_name does not exist","code":"42703"}}`

Dispatch rows created on 2026-08-28/29 exist, so this is a recent regression rather than a
never-working feature.

## Root Cause

The dispatch query selects `p.product_name` from `products`. That table's column is `name`
(`products(id, product_id, sku, name, slug, category_id, ...)`), so PostgreSQL raises `42703` and
the handler 500s before writing anything.

Note the test plan describes this data living in `dispatch_requirements` / `dispatch_balances`;
the implementation actually uses `delivery_dispatch` + `delivery_dispatch_items`
(`planned_qty`, `loaded_qty`, `delivered_qty`, `returned_qty`, `damaged_qty`, `extra_sold_qty`) —
see FU-001.

## Affected Files / API / Tables

- `apps/api/src/panels/admin/delivery/delivery.service.ts` — `dispatchToDeliveryPartner`
- `apps/api/src/panels/admin/delivery/delivery.controller.ts:@Post('dispatch/:runId')`
- Tables: `products` (`name`), `delivery_dispatch`, `delivery_dispatch_items`

## Recommended Fix

Correct the projection to `p.name AS product_name` and add a schema-drift check to CI so a
column rename cannot silently break an operational endpoint again. While in this handler, confirm
that `loaded_qty` above `planned_qty` (buffer/extra load) is persisted and surfaced to the
partner's pickup list.

## Regression Tests Required

- DSP-REQ-001 (planned + buffer aggregated per run)
- DSP-BAL-001 (pickup confirmation initialises balances)
- DP-DISP-001 / DP-DISP-002 (partner sees and confirms the pickup list)
- E2E-010 (33 dispatched → 30 delivered → 3 returned, zero discrepancy)
