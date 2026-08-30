# ISS-028 — `/admin/delivery/baskets/overview` and `/summary` return HTTP 404

| Field | Value |
|---|---|
| **Issue ID** | `ISS-028` |
| **Test Case ID(s)** | ADM-CONT-001 |
| **Module** | Admin / Delivery Baskets |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

`/admin/delivery/baskets/overview` and `/summary` return HTTP 404

## Steps to Reproduce

1. As ADMIN, `GET /api/v1/admin/delivery/baskets/overview`.
2. `GET /api/v1/admin/delivery/baskets/summary`.

## Expected Result

Basket overview and summary returned (the controller declares both routes).

## Actual Result

Both return HTTP 404 `{"message":"Cannot GET /api/v1/admin/delivery/baskets/overview","error":"Not Found"}` even though `admin-basket.controller.ts` declares `@Controller({path:'admin/delivery/baskets'})` with `@Get('overview')` and `@Get('summary')`.

## Root Cause

The routes are declared but not reachable. Most likely the controller is not registered in its module's `controllers` array, or it is shadowed by the broader `@Controller({path:'admin/delivery'})` whose `@Get('...')` wildcards match first. Note the codebase has at least one confirmed duplicate-path registration (two controllers both on `admin/customer`, see ISS-036), so route shadowing is a live pattern here.

## Affected Files / API / Tables

- `apps/api/src/panels/admin/delivery/admin-basket.controller.ts`
- the owning module's `controllers` registration
- `apps/api/src/panels/admin/delivery/delivery.controller.ts` (`admin/delivery` route ordering)

## Recommended Fix

Confirm the controller is registered, and give it a non-overlapping prefix or register it before the broader `admin/delivery` controller. Add a startup assertion (or a route-dump test) that every declared route resolves.

## Regression Tests Required

- ADM-CONT-001 (container/basket audit screen)
- Route-registration smoke test across all admin controllers
