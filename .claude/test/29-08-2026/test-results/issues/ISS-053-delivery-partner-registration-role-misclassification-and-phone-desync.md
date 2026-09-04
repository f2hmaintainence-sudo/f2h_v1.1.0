# ISS-053 — Delivery partner signup results in CUSTOMER role and null phone number

| Field | Value |
|---|---|
| **Issue ID** | `ISS-053` |
| **Test Case ID(s)** | DP-AUTH-002, REG-PARTNER-002 |
| **Module** | Authentication / Partner RBAC & Profile |
| **Severity** | **High** |
| **Status** | **Resolved** |
| **Environment** | Live production application, `f2h_fresh` PostgreSQL database |
| **Detected** | 2026-09-04 (production account: `ashoknanda130120@gmail.com`) |
| **Resolved Date** | 2026-09-04 |

## Title

Delivery partner signup through mobile app assigns role CUSTOMER, creates placeholder customer records, and leaves phone null

## Steps to Reproduce

1. Download and open the Delivery Partner mobile app.
2. Sign up or log in using Google OAuth or Mobile OTP (e.g., account `ashoknanda130120@gmail.com`).
3. Query `users`, `customers`, `delivery_partners`, and `role_assignments` for the created account:
   ```sql
   SELECT user_id, email, phone, role_id FROM users WHERE email = 'ashoknanda130120@gmail.com';
   ```

## Expected Result

1. `users.role_id` is set to `'DELIVERY_PARTNER'`.
2. `users.phone` is populated with the phone number entered by the user.
3. No conflicting row is created in `customers`.
4. A profile row is created in `delivery_partners` with `delivery_partner_id = user_id`.
5. An entry in `role_assignments` grants `DELIVERY_PARTNER` role.

## Actual Result

1. `users.role_id` remained `'CUSTOMER'`.
2. `users.phone` was `null` because Google OAuth profile did not capture phone and subsequent profile sync failed.
3. A placeholder row was inserted into `customers` (`customers.customer_id = user_id`).
4. Partner was unable to access delivery partner dashboards or receive assigned runs.

## Root Cause

1. In `apps/api/src/auth/auth.service.ts`:
   - `googleLogin()` defaulted newly registered users to `role_id: 'CUSTOMER'` and failed to check if the caller supplied `x-role: delivery_partner` or header indicating partner app context.
   - `verifyMobileOtp()` and `verifyEmailOtp()` did not forward or enforce role elevation for partner onboarding.
2. In `apps/api/src/auth/auth.controller.ts`:
   - `verifyEmailOtp` endpoint omitted `@Headers('x-role')` forwarding.
3. When partner accounts were created, obsolete satellite rows in `customers` were never purged or prevented.

## Affected Files / API / Tables

- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/auth.controller.ts`
- Tables: `users`, `customers`, `delivery_partners`, `role_assignments`

## Resolution

1. Updated `apps/api/src/auth/auth.service.ts`:
   - Added role checks in `googleLogin` and `verifyMobileOtp` to properly assign `role_id: 'DELIVERY_PARTNER'` when `x-role` is `delivery_partner` or `D`.
   - Cleaned up placeholder rows in `customers` when a user registers or logs in as a delivery partner.
   - Ensured `delivery_partners` profile is populated with branch assignment and active status.
2. Updated `apps/api/src/auth/auth.controller.ts`:
   - Forwarded `x-role` header to `verifyEmailOtp`.
3. Repaired affected database record for `ashoknanda130120@gmail.com`:
   - Elevated `role_id` to `DELIVERY_PARTNER`.
   - Updated `first_name`, `last_name`, `user_name` on `users`.
   - Deleted obsolete row in `customers`.
   - Inserted active partner profile in `delivery_partners`.
   - Inserted corresponding active grant in `role_assignments`.
