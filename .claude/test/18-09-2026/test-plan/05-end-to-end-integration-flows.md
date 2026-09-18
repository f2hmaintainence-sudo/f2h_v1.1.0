# End-to-End Business Integration Flows — Test Plan (18-09-2026)

## Scope
Validation of cross-application business scenarios spanning Admin Web, Customer Mobile/Web, Delivery Partner Mobile/Web, and Backend Schedulers:

---

## Scenarios Under Test

### Flow 1: Complete Delivery Partner Onboarding & Universal Customer Verification
1. Partner signs up via Partner Mobile App (`POST /api/v1/auth/mobile/otp/request` -> `POST /api/v1/auth/mobile/otp/verify` -> `POST /api/v1/auth/register`).
2. Verify:
   - `users` table record created with `phone`.
   - `delivery_partners` table record created.
   - **`customers` table record created with `customer_id = users.user_id`**.
3. Partner can now also log in to Customer App as a customer using the same phone/account.

### Flow 2: Admin Creates New Staff & Universal Customer Provisioning
1. Admin creates a new staff member via Admin Portal (`POST /api/v1/admin/system/admins`).
2. Verify:
   - `users` record has `phone`, `user_name`, `email`, `role_id = 'staff'`.
   - `management_staff` record created with department & branch.
   - **`customers` record created with `customer_id = users.user_id`**.
3. Staff member can also order fresh milk as a retail customer.

### Flow 3: Customer Subscription Order Lifecycle & Delivery Verification
1. Customer registers and adds delivery address mapped to Hub.
2. Customer creates daily subscription for 500ml Cow Milk.
3. Subscription order generated for tomorrow's morning slot.
4. Admin dispatch run assigns order to Delivery Partner.
5. Delivery Partner opens run in Partner App, views order list.
6. Delivery Partner marks order as `delivered`.
7. Customer opens Customer App -> Subscription Details -> clicks Delivery Orders.
8. Customer observes:
   - No duplicate active badge in product card.
   - No emoji/icon in delivery order list items.
   - Order marked as `DELIVERED`.

### Flow 4: Link-Based Referral Attribution & Reward Lifecycle (No Manual Entry)
1. Referrer (existing customer) shares invite link (e.g. `https://dev.f2hfresh.com/invite?ref=REF_CODE` or `/r/REF_CODE`).
2. Referee clicks link and opens Customer Mobile App.
3. App detects referral code from deep link / SharedPreferences, validates via `/api/v1/customer/referrals/validate/:code`, and renders the non-editable "Referral Invite Applied" badge.
4. Verify signup screen contains **zero manual input fields** for referral codes.
5. Referee completes registration (`POST /api/v1/auth/register`), automatically binding `users.referred_by` and generating `referrals` record with `status = 'pending'`.
6. Referee places first order and delivery partner marks it `delivered`.
7. Referral Reward Engine triggers atomically:
   - Referrer wallet credited ₹100.
   - Referee wallet unchanged (₹0).
   - Referee `first_order_completed = true`.
   - `referrals.status` becomes `rewarded`.
8. Subsequent delivery events are verified idempotent (no duplicate bonus credits).

