# ISS-014 — Out-of-coverage addresses are accepted and silently attached to an arbitrary branch

| Field | Value |
|---|---|
| **Issue ID** | `ISS-014` |
| **Test Case ID(s)** | CUST-ADDR-001, CUST-ADDR-002, E2E-012 |
| **Module** | Customer / Address & Branch Geofencing |
| **Severity** | **High** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Out-of-coverage addresses are accepted and silently attached to an arbitrary branch

## Steps to Reproduce

1. As a customer, `POST /api/v1/customer/bootstrap/address` at Kuppam `12.7485, 78.3644`.
2. Repeat at Chennai `13.0827, 80.2707` — far outside every branch polygon.
3. Inspect the returned `branch_id` and the branch table's coordinates/radii.

## Expected Result

Step 1 resolves to the Kuppam branch. Step 2 is rejected with
`{"status":false,"error_code":"out_of_delivery_zone","message":"Location outside service area"}`
and the app shows the waitlist banner.

## Actual Result

Both are accepted with HTTP 201 and both are assigned `branch_id: "BRANCHuGzz5gljgKYo"` —
the **Whitefield, Bengaluru** branch (12.9706693, 77.6042358):

- Kuppam address → assigned to a branch ~90 km away (the Kuppam branch `BRANCHTSfmHjqAa0f7` has a
  1.00 km radius and the pin is ~1.8 km from its centre, so nothing matched).
- Chennai address → also accepted, also assigned to Whitefield.

Orders placed against such an address inherit the wrong `branch_id`, so they are routed, dispatched
and stock-planned at the wrong hub.

## Root Cause

`assignBranchAndH3()` scores each active branch by distance against
`delivery_radius_km` (+ `buffer_zone` when `allow_buffer_order`), then falls back
unconditionally:

```ts
if (!nearestBranch && branches.length > 0) {
  nearestBranch = branches[0];
}
```

`branches[0]` comes from a query with **no `ORDER BY`**, so the fallback branch is whatever
PostgreSQL returns first — non-deterministic, and currently Whitefield. The
`BadRequestException('Currently this location is outside our delivery area.')` below it is
therefore unreachable whenever at least one active branch exists.

The two call sites also default to `addressData.branch_id = branch_id || 'BRANCH_KUPPAM_01'`, and
`BRANCH_KUPPAM_01` does not exist in the `branches` table — a dead constant that would create an
orphan FK value if it were ever reached.

Contributing data issue: the Kuppam branch's `delivery_radius_km` is 1.00 km with
`buffer_zone = 0` and `allow_buffer_order = false`, which is too small to cover the town.

## Affected Files / API / Tables

- `apps/api/src/panels/customer/auth/customer-bootstrap.controller.ts:455-512` (`assignBranchAndH3`)
- `apps/api/src/panels/customer/auth/customer-bootstrap.controller.ts:715`, `:981` (`|| 'BRANCH_KUPPAM_01'` fallbacks)
- Tables: `branches` (`lat`, `lng`, `delivery_radius_km`, `buffer_zone`, `allow_buffer_order`), `customer_addresses`, `customers`, `orders`

## Recommended Fix

1. Delete the `branches[0]` fallback and let the existing
   `BadRequestException`/`out_of_delivery_zone` response fire when nothing matches.
2. Return the documented error contract
   (`{status:false, error_code:'out_of_delivery_zone', ...}`) so the app can show the waitlist banner.
3. Remove the `'BRANCH_KUPPAM_01'` literals; a null branch must be an error, never a guess.
4. Add `ORDER BY` to the branch query for determinism.
5. Separately, review `branches.delivery_radius_km` — 1.00 km for Kuppam does not cover the
   serviced area and is what forced the fallback in the first place.

## Regression Tests Required

- CUST-ADDR-001 (in-zone pin resolves to the correct branch)
- CUST-ADDR-002 (out-of-zone pin rejected with `out_of_delivery_zone`)
- Buffer-zone test (in-buffer accepted only when `allow_buffer_order = true`)
- E2E-012 (branch geofence → order `branch_id` → run `branch_id` → warehouse)
- Data audit of existing `customer_addresses` rows for mis-assigned branches
