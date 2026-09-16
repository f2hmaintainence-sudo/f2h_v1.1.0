-- ============================================================================
-- Migration   : 025-role-permissions-schema.sql
-- Target      : PostgreSQL (f2h_dev / f2h_fresh)
-- Created At  : 2026-09-16T13:26:10.211Z
--
-- GUIDELINES FOR SAFE DATABASE VERSION CONTROLLING:
-- 1. BACKWARD COMPATIBILITY: Existing production user data must remain valid.
-- 2. EXPAND-AND-CONTRACT:
--    - When ADDING fields: Column MUST be NULLABLE or have a sensible DEFAULT.
--    - When RENAMING fields: Add new column, backfill data, deprecate old.
--    - When DELETING fields: DO NOT drop immediately; mark deprecated first.
-- 3. IDEMPOTENCY: Use 'IF NOT EXISTS' / 'IF EXISTS' wherever possible.
-- ============================================================================

BEGIN;

-- 1. Schema Changes (Expand)
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_role_id_unique ON public.roles(role_id);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id BIGSERIAL PRIMARY KEY,
    role_id VARCHAR(50) NOT NULL,
    permission_key VARCHAR(100) NOT NULL,
    module VARCHAR(50) DEFAULT NULL,
    can_view BOOLEAN DEFAULT TRUE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_role_permissions_role_key UNIQUE (role_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_key ON public.role_permissions(permission_key);
CREATE INDEX IF NOT EXISTS idx_role_permissions_module ON public.role_permissions(module);

-- 2. Seed / Backfill Default Roles in master 'roles' table first
INSERT INTO public.roles (id, sno, role_id, name, description, is_system_role, is_active, created_at, updated_at)
VALUES 
  (10, '10', 'BRANCH_MANAGER', 'Branch Manager', 'Branch-level operational management, local inventory, dispatch, and delivery partner tracking', 1, 1, NOW(), NOW()),
  (11, '11', 'MILK_PROCUREMENT_OFFICER', 'Procurement Officer', 'Manages milk and fresh produce intake, collections, fat testing, and vendor slips', 1, 1, NOW(), NOW()),
  (12, '12', 'MILK_COLLECTOR', 'Milk Collector', 'Dedicated milk collector with restricted access exclusively to daily collections', 1, 1, NOW(), NOW()),
  (13, '13', 'WAREHOUSE_MANAGER', 'Warehouse Manager', 'Inventory management, warehouse operations, stock transfers, and packing dispatch', 1, 1, NOW(), NOW()),
  (14, '14', 'DELIVERY_DISPATCHER', 'Delivery Dispatcher', 'Delivery route coordination, partner assignments, and live delivery operations', 1, 1, NOW(), NOW()),
  (15, '15', 'FINANCE_BILLING_STAFF', 'Finance & Billing Staff', 'Billing, customer outstandings, payments reconciliation, refunds, and wallet management', 1, 1, NOW(), NOW()),
  (16, '16', 'STAFF', 'Staff Member', 'General staff access for operational viewing and basic tasks', 1, 1, NOW(), NOW())
ON CONFLICT (role_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 3. Seed Permissions for Roles in 'role_permissions' table
-- Milk Collector Permissions (ONLY daily collections)
INSERT INTO public.role_permissions (role_id, permission_key, module, can_view, can_create, can_edit, can_delete, created_at, updated_at)
VALUES
  ('MILK_COLLECTOR', 'vendors.collections.view', 'vendors', TRUE, FALSE, FALSE, FALSE, NOW(), NOW()),
  ('MILK_COLLECTOR', 'vendors.collections.create', 'vendors', TRUE, TRUE, FALSE, FALSE, NOW(), NOW()),
  ('MILK_COLLECTOR', 'vendors.collections.manage', 'vendors', TRUE, TRUE, TRUE, TRUE, NOW(), NOW()),
  ('MILK_COLLECTOR', 'vendors.slips.send', 'vendors', TRUE, TRUE, FALSE, FALSE, NOW(), NOW())
ON CONFLICT (role_id, permission_key) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  updated_at = NOW();

-- Also support lowercase role_id alias for milk_collector if present
INSERT INTO public.role_permissions (role_id, permission_key, module, can_view, can_create, can_edit, can_delete, created_at, updated_at)
VALUES
  ('milk_collector', 'vendors.collections.view', 'vendors', TRUE, FALSE, FALSE, FALSE, NOW(), NOW()),
  ('milk_collector', 'vendors.collections.create', 'vendors', TRUE, TRUE, FALSE, FALSE, NOW(), NOW()),
  ('milk_collector', 'vendors.collections.manage', 'vendors', TRUE, TRUE, TRUE, TRUE, NOW(), NOW()),
  ('milk_collector', 'vendors.slips.send', 'vendors', TRUE, TRUE, FALSE, FALSE, NOW(), NOW())
ON CONFLICT (role_id, permission_key) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  updated_at = NOW();

COMMIT;
