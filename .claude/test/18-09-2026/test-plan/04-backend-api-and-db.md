# Backend API & Database Engine — Comprehensive Test Plan (18-09-2026)

## Scope
Verification of core backend engineering standards, database schema integrity, and architectural rules:
1. Users Table Schema Single Source of Truth (`phone`, `first_name`, `last_name`, `email`, `user_name`)
2. Universal Customer Rule: Every user has a row in `customers` table
3. Database Migrations Status (001 through 028)
4. SQL JOIN standard on all satellite queries
5. PostgreSQL Parameter Binding (`$1`, `$2`)
6. REST API kebab-case routing compliance
7. Redis cache operations and session store

---

## Test Cases

### 1. Database Schema & Migration Integrity
- **TC-DB-001: All Migrations Applied Cleanly**
  - **Tool**: `npm run db:migrate`
  - **Assert**: Output indicates all migrations up to `028-backfill-universal-customers.sql` are applied.
- **TC-DB-002: Universal Customer Invariant Check**
  - **Query**:
    ```sql
    SELECT COUNT(*) AS unlinked_users_count
    FROM users u
    LEFT JOIN customers c ON c.customer_id = u.user_id
    WHERE c.customer_id IS NULL;
    ```
  - **Assert**: `unlinked_users_count` is 0. Every user has a matching record in `customers`.

### 2. Phone Number Persistence
- **TC-DB-003: Phone Column Integrity on Users Table**
  - **Check**: Verify that newly created records from OTP, Registration, Admin Add Customer, Admin Add Delivery Partner, and Admin Add Staff have non-null, trimmed phone numbers in `users.phone`.
- **TC-DB-004: No Identity Duplication in Satellite Tables**
  - **Check**: Verify satellite tables (`customers`, `delivery_partners`, `management_staff`) do not maintain duplicate phone columns or circumvent `users` table as source of truth.

### 3. REST API Kebab-Case Routing
- **TC-API-001: Route Paths Case Compliance**
  - **Rule**: All API endpoints use lowercase `kebab-case`.
  - **Verification**:
    - `@Controller({ path: 'delivery-partner/profile', ... })` -> Valid.
    - `@Controller({ path: 'delivery-partner/orders', ... })` -> Valid.
    - Legacy alias support preserves compatibility.

### 4. Parameter Binding Standard
- **TC-API-002: PostgreSQL Placeholder Verification**
  - **Rule**: PostgreSQL query parameters must use `$1`, `$2`, `$3` instead of MySQL `?`.
  - **Verification**: Ripgrep audit across `apps/api/src` confirms zero MySQL `?` placeholders in active SQL queries.
