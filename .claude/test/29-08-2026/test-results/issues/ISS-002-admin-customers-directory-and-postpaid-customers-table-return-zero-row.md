# ISS-002 — Admin Customers directory and Postpaid Customers table return zero rows for every request

| Field | Value |
|---|---|
| **Issue ID** | `ISS-002` |
| **Test Case ID(s)** | ADM-CUST-001, ADM-CUST-002 |
| **Module** | Admin / Customers Directory |
| **Severity** | **Critical** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Admin Customers directory and Postpaid Customers table return zero rows for every request

## Steps to Reproduce

1. Authenticate as ADMIN.
2. `GET /api/v1/admin/customer/table?page=1&limit=5`
3. `GET /api/v1/admin/customer/table?search=9000900002`
4. `GET /api/v1/admin/customer/postpaid/table`
5. Compare with `SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL` (= 41).

## Expected Result

The DataTable returns the customer rows (41 records available), with Full Name, Wallet Balance,
Phone, Email and Created At, and search by phone filters to the matching customer.

## Actual Result

Every request returns HTTP 200 with:
`{"status":false,"draw":1,"data":[],"columns":[...],"recordsTotal":"41","recordsFiltered":"41","message":""}`

`recordsTotal` is correct (41) but `data` is always `[]` and `status` is `false`.
The Admin Panel customer list is therefore permanently empty — no customer can be opened,
edited, blocked, given a postpaid limit, or have a wallet adjusted from the directory.

`apps/api/logs/app.log` records on every call:
`ERROR : Database Error (shared conn) {"table":"customers","error":"Invalid column name: CONCAT_WS(' ', users.first_name, users.last_name)"}`

## Root Cause

The table definition declares the display-name column as a raw SQL expression:

```ts
full_name: ["CONCAT_WS(' ', users.first_name, users.last_name)", true],
```

`DataService`'s SELECT sanitiser only whitelists raw expressions that begin with `(` or `COALESCE(`:

```ts
if (typeof rawCol === 'string' && (rawCol.trim().startsWith('(') || rawCol.trim().toUpperCase().startsWith('COALESCE('))) { ... }
...
if (plainCol !== '*' && !identifierRegex.test(plainCol)) throw new Error(`Invalid column name: ${plainCol}`);
```

`CONCAT_WS(` matches neither branch, so the data query throws. The count queries do not select
that column, which is why `recordsTotal` is still correct while `data` is empty. `DataService`
catches the throw and returns `{status:false, data:[]}` rather than propagating an error, so the
endpoint reports HTTP 200.

## Affected Files / API / Tables

- `apps/api/src/panels/admin/customers/services/table.service.ts:91` (`full_name` column definition)
- `apps/api/src/shared/database/Data.service.ts:1615-1644` (SELECT identifier sanitiser)
- Same pattern also breaks `admin/customer/postpaid/table` and `admin/delivery/leave-requests/table` (see ISS-027)
- `apps/api/src/panels/admin/branch-Management/services/table.service.ts:170` uses the same construct

## Recommended Fix

Preferred: wrap the expression so it passes the existing whitelist, i.e.
`COALESCE(CONCAT_WS(' ', users.first_name, users.last_name), users.user_name)`.

Better long-term: extend the sanitiser to accept a vetted allow-list of SQL functions
(`CONCAT_WS`, `CONCAT`, `NULLIF`, `TRIM`, `UPPER`, `LOWER`) rather than only `(` / `COALESCE(`,
and make `DataService` propagate the error instead of returning `status:false` with HTTP 200
(see ISS-041).

## Regression Tests Required

- ADM-CUST-001 (directory lists customers; search by phone/email/name filters correctly)
- ADM-CUST-002 (postpaid settings editable from the directory row)
- Regression test for `admin/customer/postpaid/table`
- Regression test for `admin/delivery/leave-requests/table`
- A unit test on the sanitiser covering every raw expression used in a `TableSet`
