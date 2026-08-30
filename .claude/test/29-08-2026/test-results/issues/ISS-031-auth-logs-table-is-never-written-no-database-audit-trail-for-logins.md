# ISS-031 — `auth_logs` table is never written — no database audit trail for logins

| Field | Value |
|---|---|
| **Issue ID** | `ISS-031` |
| **Test Case ID(s)** | ADM-AUTH-001, ADM-AUTH-002, ADM-AUTH-003 |
| **Module** | Auth / Audit Trail |
| **Severity** | **Medium** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

`auth_logs` table is never written — no database audit trail for logins

## Steps to Reproduce

1. Perform a successful admin login, five failed logins and a logout.
2. `SELECT COUNT(*) FROM auth_logs;`
3. `grep -rn "auth_logs" apps/api/src`.

## Expected Result

`auth_logs` records each attempt with action, status, IP address and user agent, as the test plan's verification points require.

## Actual Result

`SELECT COUNT(*) FROM auth_logs` returns **0** — the table has never received a row. `grep` finds no reference to `auth_logs` anywhere in `apps/api/src`.

Auth events *are* captured, but only to rotating files via Winston:
```
info: TOKEN_OPERATION {"event":"TOKEN_GENERATED","userId":"QA_ADM_01",...}
warn: LOGIN_FAILURE {"attempt":4,"reason":"Incorrect password",...}
```
(`apps/api/logs/audit-YYYY-MM-DD.log`, 90-day retention; critical events 180 days.)

## Root Cause

`AuditLoggerService` is a pure Winston file logger with no database writer. The `auth_logs` table exists in the schema but nothing references it, and its shape (`login_at`, `logout_at`, `is_online`, `session_token`, `last_activity_at`) is a session-tracking design rather than the `action`/`status` event log the test plan describes — so the table and the code were designed against different models.

## Affected Files / API / Tables

- `apps/api/src/auth/audit-logger.service.ts`
- `apps/api/src/auth/auth.controller.ts` (login/logout handlers)
- Table: `auth_logs` (unused)

## Recommended Fix

Pick one model and make it real. Either (a) add a database sink to `AuditLoggerService` writing login success/failure/logout to `auth_logs`, reshaping the table to `(user_id, action, status, ip_address, user_agent, created_at)`; or (b) drop `auth_logs` and update the test plan to assert against the audit log files. Option (a) is preferable — file logs are not queryable from the Admin Panel's audit screen.

## Regression Tests Required

- ADM-AUTH-001 (successful login recorded)
- ADM-AUTH-002 (failed attempts recorded with reason)
- ADM-AUTH-003 (logout recorded)
- `/admin/system/audit` surfaces the entries
