# Admin Panel Web — Comprehensive Test Plan (18-09-2026)

## Scope
Verification of back-office operations across all administrative modules:
1. Admin Authentication & Role-Based Access
2. Staff Management & System Users
3. Customer Management & Details
4. Delivery Partner Operations
5. Logistics & Vendors Management (Collections, Produce, Phone support)
6. Catalog & Inventory Management
7. Orders & Subscriptions Operations
8. Finance, Postpaid Billing & PDF Invoices
9. System Settings & Audit Logs

---

## Test Cases

### 1. Authentication & Session Management
- **TC-ADM-001: Admin Credentials Sign-In**
  - **Endpoint**: `POST /api/v1/auth/login`
  - **Payload**: Email/Username + Password
  - **Assert**: Returns 200 OK, JWT Bearer token, User profile with `role_id = ADMIN` or `SUPER_ADMIN`.
- **TC-ADM-002: Session Identity Retrieval**
  - **Endpoint**: `GET /api/v1/users/me`
  - **Assert**: Returns user details joined from `users` table, permissions array, and active roles.

### 2. Staff Management & System Users
- **TC-ADM-003: Admin Add New Staff (With Universal Customer Rule)**
  - **Endpoint**: `POST /api/v1/admin/system/admins`
  - **Payload**: `user_name`, `email`, `phone`, `password`, `role_id: "staff"`, `branch_id`, `department`
  - **Verification**:
    1. HTTP 200/201 response.
    2. Record created in `users` table with `phone = body.phone`.
    3. Record created in `management_staff` table.
    4. **Universal Customer Rule**: Record automatically created in `customers` table with `customer_id = users.user_id` and `customer_type = 'retail'`.
- **TC-ADM-004: Staff List & Details Query**
  - **Endpoint**: `GET /api/v1/admin/system/admins`
  - **Assert**: Lists all staff members with full names, phone numbers from `users`, and departments from `management_staff`.

### 3. Customer Management
- **TC-ADM-005: Admin Add Customer**
  - **Endpoint**: `POST /api/v1/admin/customers/save-add`
  - **Payload**: `full_name`, `phone`, `email`, `customer_type: "retail"`, `branch_id`
  - **Verification**:
    1. HTTP 200 response.
    2. Phone stored on `users` table.
    3. Satellite record created in `customers` table with matching `customer_id`.
- **TC-ADM-006: Customer Table Listing & Pagination**
  - **Endpoint**: `POST /api/v1/admin/customers/table`
  - **Assert**: Returns paginated customer rows, correct page index, total counts, and identity fields joined from `users`.

### 4. Delivery Partner Operations
- **TC-ADM-007: Admin Add Delivery Partner (With Universal Customer Rule)**
  - **Endpoint**: `POST /api/v1/admin/delivery/save-add`
  - **Payload**: `full_name`, `phone`, `email`, `branch_id`, `daily_salary`, `max_daily_orders`
  - **Verification**:
    1. HTTP 200 response.
    2. Identity created in `users` table with `phone = body.phone`.
    3. Domain record created in `delivery_partners` table.
    4. **Universal Customer Rule**: Satellite record created in `customers` table with `customer_id = partnerId`.
- **TC-ADM-008: Delivery Partners Table Listing**
  - **Endpoint**: `POST /api/v1/admin/delivery/table`
  - **Assert**: Returns active partners, vehicle info, and phone/name joined from `users`.

### 5. Logistics & Vendors Management
- **TC-ADM-009: Vendor Listing & Registration**
  - **Endpoint**: `GET /api/v1/admin/logistics/vendors` or package service
  - **Assert**: Returns active vendor list, contact phone numbers, and status.
- **TC-ADM-010: Vendor Collections & Produce Verification**
  - **Endpoint**: `GET /api/v1/admin/logistics/collections`
  - **Assert**: Verifies schema 021-024 support for vendor collections, phone numbers, and produce records.

### 6. Finance & Invoicing
- **TC-ADM-011: PDF Invoice Generation (Auto-Paging Fix Verification)**
  - **Endpoint**: `GET /api/v1/finance/invoices/:id/pdf`
  - **Assert**: Generates clean PDF without blank/empty overflow trailing pages.
- **TC-ADM-012: Customer Billing Ledger**
  - **Endpoint**: `GET /api/v1/finance/bills`
  - **Assert**: Returns customer bills, payment status, and period dates.
