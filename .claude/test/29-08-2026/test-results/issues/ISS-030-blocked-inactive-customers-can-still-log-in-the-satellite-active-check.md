# ISS-030 — Blocked/inactive customers can still log in — the satellite active check fails open on a missing column

| Field | Value |
|---|---|
| **Issue ID** | `ISS-030` |
| **Test Case ID(s)** | ADM-AUTH-001, ADM-CUST-001 |
| **Module** | Auth / Account Status Enforcement |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Blocked/inactive customers can still log in — the satellite active check fails open on a missing column

## Steps to Reproduce

1. `POST /api/v1/auth/login` as any customer with header `X-Role: CUSTOMER`.
2. Watch `apps/api/logs/app.log` during the call.

## Expected Result

A customer whose account is blocked or deactivated is rejected with *"Your account is inactive. Please contact support."*

## Actual Result

Login always succeeds. Every customer login logs:

```
ERROR : Error checking satellite is_active status: {"code":"42703","routine":"errorMissingColumn"}
DatabaseService Query failed: 'SELECT is_active FROM customers WHERE customer_id = $1 LIMIT 1'
```

(observed repeatedly in the live error log, roughly every couple of minutes under normal traffic).

## Root Cause

`AuthService.checkSatelliteIsActive()` runs `SELECT is_active FROM customers WHERE customer_id = $1` for the CUSTOMER app. The `customers` table has **no `is_active` column** — its status columns are `is_blocked` and `block_reason`. The query throws `42703`; the surrounding `try/catch` returns `true`:

```ts
} catch (e) {
  this.developer.error('Error checking satellite is_active status:', e);
  return true;   // fails open
}
```

So the customer branch of the check has never had any effect, and `is_blocked` is never consulted anywhere in the login path. (The DELIVERY_PARTNER and ADMIN branches query `delivery_partners.is_active` and `management_staff.is_active`, which do exist and do work.)

## Affected Files / API / Tables

- `apps/api/src/auth/auth.service.ts:90-138` (`checkSatelliteIsActive`)
- Tables: `customers` (`is_blocked`), `delivery_partners`, `management_staff`

## Recommended Fix

Query the column that exists and treat a blocked account as inactive:

```sql
SELECT (NOT COALESCE(is_blocked, false)) AS is_active FROM customers WHERE customer_id = $1 LIMIT 1
```

Also change the catch to fail **closed** (or at minimum re-raise) — a security check that silently returns `true` on error is worse than no check, because it looks like it is working.

## Regression Tests Required

- Blocked customer cannot log in and receives the documented message
- Unblocked customer can log in
- Partner/admin satellite checks still work (must not regress)
- Negative test: a database error in the check denies access rather than granting it
