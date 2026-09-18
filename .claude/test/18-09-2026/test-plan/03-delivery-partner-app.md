# Delivery Partner Application — Comprehensive Test Plan (18-09-2026)

## Scope
Verification of delivery operations and logistics across the Delivery Partner application:
1. Delivery Partner App Authentication & Universal Customer Linking
2. Shift Toggling (Online / Offline validation)
3. Delivery Run Management & Orders Queue
4. Route Navigation & Delivery Address Verification
5. Delivery Status Updates (Delivered, Undelivered, Skipped) with OTP / Proof
6. Cash / UPI Payment Collection on Delivery
7. Bottle / Container Reconciliation & Handover
8. Partner Wallet, Earnings & Performance Stats

---

## Test Cases

### 1. Delivery Partner Registration & Auth
- **TC-DP-001: Partner Registration via Partner App (With Universal Customer Rule)**
  - **Endpoint**: `POST /api/v1/auth/register` with `role: "DELIVERY_PARTNER"`
  - **Payload**: `phone`, `first_name`, `last_name`, `verification_token`, `vehicle_type`
  - **Verification**:
    1. HTTP 200 OK.
    2. Identity row created/updated in `users` with `phone = body.phone`.
    3. Satellite row created in `delivery_partners` table.
    4. **Universal Customer Rule**: Satellite row automatically created in `customers` table with `customer_id = users.user_id`.
    5. Database check verifies **NO** customer deletion occurred.
- **TC-DP-002: Partner Sign-In & Profile Hydration**
  - **Endpoint**: `GET /api/v1/delivery-partner/profile`
  - **Assert**: Returns profile with identity fields from `users` (name, phone, email) joined with domain fields from `delivery_partners` (vehicle type, branch, online status).

### 2. Shift Management
- **TC-DP-003: Toggle Shift Online**
  - **Endpoint**: `POST /api/v1/delivery-partner/auth/shift-status`
  - **Payload**: `{ "active": true }`
  - **Assert**: `is_online = true`, `is_active = true`, partner becomes available for dispatch assignment.
- **TC-DP-004: Prevent Going Offline With Undelivered Orders**
  - **Precondition**: Partner has 1 or more pending orders in today's assigned delivery run.
  - **Endpoint**: `POST /api/v1/delivery-partner/auth/shift-status`
  - **Payload**: `{ "active": false }`
  - **Assert**: HTTP 400 BadRequest: "Cannot go offline. You still have undelivered orders in your queue."

### 3. Delivery Execution & Orders
- **TC-DP-005: Fetch Assigned Orders Queue**
  - **Endpoint**: `GET /api/v1/delivery-partner/orders`
  - **Assert**: Returns list of today's assigned orders sorted by delivery sequence, customer contact info, delivery instructions, and product quantities.
- **TC-DP-006: Mark Order as Delivered**
  - **Endpoint**: `POST /api/v1/delivery-partner/orders/:id/status`
  - **Payload**: `{ "status": "delivered", "notes": "Left at door" }`
  - **Verification**:
    1. Order status updated to `delivered`.
    2. Timestamp `delivered_at` populated.
    3. Entry recorded in `order_status_logs`.
    4. If subscription first order, sets `first_order_completed = true` on `customers`.

### 4. Container Reconciliation & Handover
- **TC-DP-007: Empty Milk Bottle Handover**
  - **Endpoint**: `POST /api/v1/delivery-partner/orders/:id/container-reconciliation`
  - **Payload**: `{ "returned_containers": 2, "delivered_containers": 2 }`
  - **Assert**: Container balance updated in `customer_container_balances` and `delivery_container_reconciliation`.
