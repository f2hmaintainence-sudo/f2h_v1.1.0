# 13 — Test Data Requirements & Golden Master Fixtures

> **Purpose:** Standardized Baseline Test Data Fixtures for Automated & Manual Quality Assurance  
> **Target Databases:** `f2hfresh_test` / Local & Staging Sandboxes

---

## 1. Core Master Entities & Golden Fixtures

### 1.1 Branches & Geofence Polygons

```sql
INSERT INTO branches (
  id, branch_id, branch_name, branch_code, city, state, is_active,
  lat, lng, delivery_radius_km, buffer_zone, allow_buffer_order, created_at, updated_at
) VALUES (
  1, 'BRANCH_KUPPAM_01', 'Kuppam Main Branch', 'KUP_01', 'Kuppam', 'Andhra Pradesh', true,
  12.7485, 78.3644, 15.0,
  '{"type": "Polygon", "coordinates": [[[78.35, 12.73], [78.38, 12.73], [78.38, 12.76], [78.35, 12.76], [78.35, 12.73]]]}'::jsonb,
  true, NOW(), NOW()
) ON CONFLICT (branch_id) DO NOTHING;
```

---

### 1.2 Warehouses & Container Master

```sql
-- Warehouse
INSERT INTO warehouses (
  id, warehouse_id, name, code, branch_id, address, is_active, created_at, updated_at
) VALUES (
  1, 'WH-KUPPAM-MAIN', 'Kuppam Central Hub', 'WH_KUP_01', 'BRANCH_KUPPAM_01', 'Kuppam Industrial Estate', true, NOW(), NOW()
) ON CONFLICT (warehouse_id) DO NOTHING;

-- Returnable Containers
INSERT INTO containers (
  id, container_id, name, container_type, volume_ml, deposit_amount, is_returnable, is_active, created_at, updated_at
) VALUES 
  (1, 'CONT-001', '1L Returnable Glass Bottle', 'glass_bottle', 1000, 50.00, true, true, NOW(), NOW()),
  (2, 'CONT-002', '24-Slot Delivery Crate', 'crate', 24000, 200.00, true, true, NOW(), NOW())
ON CONFLICT (container_id) DO NOTHING;

-- Warehouse Container Stock
INSERT INTO warehouse_containers (
  warehouse_id, container_id, quantity, created_at, updated_at
) VALUES 
  ('WH-KUPPAM-MAIN', 'CONT-001', 500, NOW(), NOW()),
  ('WH-KUPPAM-MAIN', 'CONT-002', 30, NOW(), NOW())
ON CONFLICT (warehouse_id, container_id) DO UPDATE SET quantity = 500;
```

---

### 1.3 Categories, Products & Variants

```sql
-- Categories
INSERT INTO categories (
  id, category_id, name, slug, is_active, sort_order, created_at, updated_at
) VALUES 
  (1, 'CAT_DAIRY', 'Dairy & Fresh Milk', 'dairy-fresh-milk', true, 1, NOW(), NOW()),
  (2, 'CAT_EGGS', 'Farm Fresh Eggs', 'farm-fresh-eggs', true, 2, NOW(), NOW())
ON CONFLICT (category_id) DO NOTHING;

-- Products
INSERT INTO products (
  id, product_id, category_id, name, slug, unit_type, gst_percentage, is_subscribable, is_one_time, is_returnable, is_active, created_at, updated_at
) VALUES 
  (1, 'PROD_MILK', 'CAT_DAIRY', 'Farm Fresh Raw Cow Milk', 'farm-fresh-raw-cow-milk', 'ml', 0.0, true, true, true, true, NOW(), NOW()),
  (2, 'PROD_EGGS', 'CAT_EGGS', 'Country Chicken Eggs', 'country-chicken-eggs', 'pcs', 0.0, true, true, false, true, NOW(), NOW())
ON CONFLICT (product_id) DO NOTHING;

-- Product Variants
INSERT INTO product_variants (
  id, variant_id, product_id, name, sku, price, subscription_price, unit_value, unit_type, container_id, is_out_of_stock, status, sort_order, created_at, updated_at
) VALUES 
  (1, 'VAR_MILK_1L', 'PROD_MILK', 'Cow Milk 1000ml Bottle', 'MLK-1L', 75.00, 70.00, 1000, 'ml', 'CONT-001', false, 'active', 1, NOW(), NOW()),
  (2, 'VAR_EGGS_6', 'PROD_EGGS', 'Country Eggs 6 Pack', 'EGG-6P', 60.00, 60.00, 6, 'pcs', NULL, false, 'active', 2, NOW(), NOW())
ON CONFLICT (variant_id) DO NOTHING;
```

---

### 1.4 Test Accounts & User Personas

| Persona | `user_id` | `email` | `phone` | Roles | Password Hash (bcrypt) | Satellite Setup |
|---|---|---|---|---|---|---|
| **Super Admin** | `USR_ADMIN_01` | `admin@f2hfresh.com` | `9876500000` | `ADMIN` | `$2b$10$MasterAdminHash` | Superuser permissions (manages all modules) |
| **Delivery Partner** | `USR_DP_01` | `dp.ramesh@f2hfresh.com` | `9876543210` | `DELIVERY_PARTNER` | `$2b$10$DeliveryBoyHash` | `delivery_partners` table + `is_verified = true` |
| **Prepaid Customer** | `USR_CUST_PRE` | `cust.prepaid@f2hfresh.com` | `9123456780` | `CUSTOMER` | `$2b$10$PrepaidCustomerHash` | `wallet_balance = 2500.00` |
| **Postpaid Customer** | `USR_CUST_POST` | `cust.postpaid@f2hfresh.com` | `9123456781` | `CUSTOMER` | `$2b$10$PostpaidCustomerHash` | `is_postpaid_enabled = true`, `limit = 5000.00` |

---

### 1.5 Coupons & Promotions

```sql
INSERT INTO coupons (
  id, coupon_id, code, title, discount_type, discount_value, min_order_amount, max_discount, is_active, created_at, updated_at
) VALUES (
  1, 'CPN_FRESH50', 'FRESH50', 'Flat ₹50 Off on orders above ₹200', 'fixed', 50.00, 200.00, 50.00, true, NOW(), NOW()
) ON CONFLICT (coupon_id) DO NOTHING;
```
