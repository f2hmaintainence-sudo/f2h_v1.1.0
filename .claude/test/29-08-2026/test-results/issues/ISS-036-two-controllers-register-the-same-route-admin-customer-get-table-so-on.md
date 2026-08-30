# ISS-036 — Two controllers register the same route `admin/customer` + `GET table`, so one silently shadows the other

| Field | Value |
|---|---|
| **Issue ID** | `ISS-036` |
| **Test Case ID(s)** | ADM-CUST-001 |
| **Module** | Platform / Route Registration |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Two controllers register the same route `admin/customer` + `GET table`, so one silently shadows the other

## Steps to Reproduce

1. `grep -rn "@Controller" apps/api/src/panels/admin | grep "admin/customer"`.
2. `GET /api/v1/admin/customer/table` and compare the response shape against each controller's column definition.

## Expected Result

Each route resolves to exactly one handler, and duplicate registrations are detected at startup.

## Actual Result

Two controllers declare the same path:
```
src/panels/admin/customers/customers.controller.ts                  @Controller({ path: '/admin/customer' })   @Get('table')
src/panels/admin/branch-Management/controllers/customer.controller.ts @Controller({ path: 'admin/customer' })    @Get('table')
```
and there are two distinct `getCustomerTable` implementations with different column sets
(`customers.service.ts:936` and `services/table.service.ts:33`). The response shape shows `CustomerTableService` wins; the other implementation is unreachable dead code. Nest logs no warning.

The same class of problem is the likely cause of ISS-028 (baskets routes returning 404).

## Root Cause

Nest registers routes in module-import order and the first match wins; duplicate path+method registrations are silently tolerated. Two independently-developed customer table implementations were both mounted at `admin/customer/table`.

## Affected Files / API / Tables

- `apps/api/src/panels/admin/customers/customers.controller.ts:41`
- `apps/api/src/panels/admin/branch-Management/controllers/customer.controller.ts`
- `apps/api/src/panels/admin/customers/customers.service.ts:936` vs `apps/api/src/panels/admin/customers/services/table.service.ts:33`

## Recommended Fix

Delete or re-path the redundant controller and its service, so there is one customer-directory implementation. Add a startup check (or a test over Nest's router explorer) that fails the build on duplicate `method + path` registrations, which would also have caught ISS-028.

## Regression Tests Required

- ADM-CUST-001 (directory served by the intended handler)
- Route-uniqueness test across the whole application
- Route-dump snapshot test to catch future shadowing
