# FU-009 — Delivery Partner Onboarding Schema Alignment & Role Escalation

| Field | Value |
|---|---|
| **Feature/Update ID** | `FU-009` |
| **Related Test Case(s)** | DP-AUTH-001, DP-AUTH-002, ISS-052, ISS-053 |
| **Status** | **Implemented & Verified** |
| **Raised** | 2026-09-04 |

## Current Behaviour

1. Satellite table `delivery_partners` had obsolete application queries attempting to insert/update `user_id` and `referred_by`, causing PostgreSQL error `42703 column "user_id" of relation "delivery_partners" does not exist`.
2. When delivery partners registered via Google OAuth or OTP, role resolution defaulted to `CUSTOMER` because `x-role` was not properly propagated or evaluated.
3. Obsolete placeholder rows in `customers` were retained for partner accounts, causing data desynchronization between user identity and operational roles.

## Required Behaviour

1. **Schema Single Source of Truth:**
   All identity (`first_name`, `last_name`, `phone`, `email`, `user_name`) and referral tracking (`referred_by`) fields must live strictly on the `users` table.
2. **Domain Satellite Isolation:**
   `delivery_partners` must contain only partner domain extensions (`branch_id`, `vehicle_type`, `daily_salary`, `is_active`, `is_available`) keyed by `delivery_partner_id`.
3. **Role Escalation & Cleanup:**
   Registration or login originating from delivery partner channels (identified via `x-role: delivery_partner` or `x-role: D`) must set `users.role_id = 'DELIVERY_PARTNER'`, create an active grant in `role_assignments`, create a `delivery_partners` domain profile, and purge any conflicting placeholder row in `customers`.

## Exact Implementation Requirement

1. **`apps/api/src/auth/auth.service.ts`:**
   - Remove `user_id` and `referred_by` from `delivery_partners` queries; use `delivery_partner_id`.
   - Store `referred_by` on `users` table.
   - Detect partner role context in `googleLogin()` and `verifyMobileOtp()`.
   - Delete placeholder rows from `customers` where `customer_id = userId` upon partner account creation.
2. **`apps/api/src/auth/auth.controller.ts`:**
   - Add `@Headers('x-role')` parameter binding to `verifyEmailOtp`.
3. **Database Audit:**
   - Clean up existing affected partner accounts (e.g. `ashoknanda130120@gmail.com`), ensuring active partner profiles, correct branch assignment, and `DELIVERY_PARTNER` role assignment.

## Affected Modules / Files

- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/auth.controller.ts`
- Tables: `users`, `delivery_partners`, `customers`, `role_assignments`

## Verification & Impact

- Verified partner registration flow no longer queries `user_id` on `delivery_partners`.
- Partner account `ashoknanda130120@gmail.com` updated to `DELIVERY_PARTNER` with active satellite profile in `delivery_partners` and active grant in `role_assignments`.
- `npm run build:api` passed and PM2 service reloaded cleanly.
