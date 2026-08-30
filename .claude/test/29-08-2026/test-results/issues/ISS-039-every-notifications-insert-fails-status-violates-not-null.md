# ISS-039 — Every `notifications` insert fails — `status` violates NOT NULL

| Field | Value |
|---|---|
| **Issue ID** | `ISS-039` |
| **Test Case ID(s)** | ADM-DEL-003, CUST-ORD-003 |
| **Module** | Notifications / Persistence |
| **Severity** | **Low** |
| **Status** | Open — reported, not fixed |
| **Environment** | Live application, `f2h_fresh` database, API `:5001`, Admin Web `:5002` |
| **Detected** | 2026-08-29 |

## Title

Every `notifications` insert fails — `status` violates NOT NULL

## Steps to Reproduce

1. Trigger any notification-producing action (order cancellation, leave approval, cron completion).
2. Watch `/home/f2hfresh/logs/pm2/api-err.log`.

## Expected Result

A `notifications` row is written and delivered to the recipient.

## Actual Result

The insert fails every time, roughly every two minutes under normal traffic:
```
ERROR [DatabaseService] Query failed
  sql: "INSERT INTO notifications (notification_id, title, message, medium, type, priority, status, created_at, updated_at)
        VALUES ($1, $2, $3, 'push', 'info', 'high', true, $4, $4)"
  errorCode: '23502'
```
The failure is swallowed, so callers report success while no notification is stored.

## Root Cause

The statement passes the boolean literal `true` for `status`. `notifications.status` is a non-boolean NOT NULL column, so the bind resolves to NULL and PostgreSQL raises `23502 null value in column "status"`. The same insert also participates in the order-cancellation transaction (ISS-005), where it is one of the statements that abort after the first failure.

## Affected Files / API / Tables

- the shared notification insert helper (used by cron completion, order cancellation, leave approval)
- Table: `notifications` (`status`)

## Recommended Fix

Pass a valid status value for the column's type (e.g. `'unread'` / `'pending'`) instead of `true`, and align the column definition with the intended vocabulary. Add a `CHECK` constraint or enum so an invalid value fails at development time rather than silently at runtime.

## Regression Tests Required

- ADM-DEL-003 (leave approval notification persisted and delivered)
- CUST-ORD-003 (cancellation notification persisted)
- Cron completion notification to admins persisted
