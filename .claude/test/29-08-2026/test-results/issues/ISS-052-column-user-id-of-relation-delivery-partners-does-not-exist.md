# ISS-052 — Delivery partner signup database write fails: column "user_id" does not exist

| Field | Value |
|---|---|
| **Issue ID** | `ISS-052` |
| **Test Case ID(s)** | DP-AUTH-001, REG-PARTNER-001 |
| **Module** | Authentication / Delivery Partner Onboarding |
| **Severity** | **Critical** |
| **Status** | **Resolved** |
| **Environment** | Live production application, `f2h_fresh` PostgreSQL database |
| **Detected** | 2026-09-04 (production error logs) |
| **Resolved Date** | 2026-09-04 |

## Title

Delivery partner signup database write fails: column "user_id" of relation "delivery_partners" does not exist

## Steps to Reproduce

1. Register a new delivery partner account via mobile app or `POST /api/v1/auth/register` with role `DELIVERY_PARTNER`.
2. Provide registration payload including `phone`, `referred_by`, `role_id: "DELIVERY_PARTNER"`.
3. Inspect production logs in `apps/api/logs/app.log`.

## Expected Result

The user account is created with `role_id = 'DELIVERY_PARTNER'`.
Identity details (`first_name`, `last_name`, `phone`, `email`, `referred_by`) are stored in `users`.
A delivery partner domain profile is created in `delivery_partners` linked via `delivery_partner_id`.

## Actual Result

The API query failed with a PostgreSQL 42703 database error:
```json
{"table":"delivery_partners","errorCode":"42703","error":"column \"user_id\" of relation \"delivery_partners\" does not exist"}
```
The partner registration failed to persist properly and rolled back or left orphaned state.

## Root Cause

In `apps/api/src/auth/auth.service.ts` (`register()` lines 618 and 634):
The insert and update queries targeted the satellite table `delivery_partners` using columns:
- `user_id`
- `referred_by`

Per the unified database architecture:
1. `delivery_partners` contains **only** domain-specific delivery fields (`delivery_partner_id`, `branch_id`, `vehicle_type`, `daily_salary`, `is_active`, `is_available`, etc.).
2. The primary key / foreign key linking to users is `delivery_partner_id` (not `user_id`).
3. User identity and referral lineage (`phone`, `email`, `referred_by`) live exclusively on the `users` table.

## Affected Files / API / Tables

- `apps/api/src/auth/auth.service.ts`
- Tables: `delivery_partners`, `users`

## Resolution

1. Updated `apps/api/src/auth/auth.service.ts`:
   - Stripped `user_id` and `referred_by` from all `delivery_partners` insert and update queries.
   - Used `delivery_partner_id: userId` as the satellite record identifier.
   - Stored `referred_by` directly on the `users` record.
2. Verified schema alignment on PostgreSQL `delivery_partners` table.
