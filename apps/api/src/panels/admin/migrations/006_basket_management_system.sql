-- ============================================================================
-- Migration: 006_basket_management_system.sql
-- Description: Production-ready Basket Management System for F2H Fresh
-- ============================================================================

-- 1. Add item_status to order_items table for individual item delivery tracking
ALTER TABLE order_items 
  ADD COLUMN IF NOT EXISTS item_status VARCHAR(50) DEFAULT 'PENDING';

-- 2. Delivery Baskets Table
CREATE TABLE IF NOT EXISTS delivery_baskets (
  id VARCHAR(100) PRIMARY KEY,
  delivery_partner_id VARCHAR(100) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  delivery_run_id VARCHAR(100) NULL,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_DELIVERY', 'RETURNING', 'CLOSED')),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ NULL,
  reconciled_by VARCHAR(100) NULL,
  reconciliation_notes TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_baskets_partner_date ON delivery_baskets(delivery_partner_id, delivery_date);
CREATE INDEX IF NOT EXISTS idx_delivery_baskets_run ON delivery_baskets(delivery_run_id);
CREATE INDEX IF NOT EXISTS idx_delivery_baskets_status ON delivery_baskets(status);

-- 3. Basket Items Table
CREATE TABLE IF NOT EXISTS basket_items (
  id VARCHAR(100) PRIMARY KEY,
  basket_id VARCHAR(100) NOT NULL REFERENCES delivery_baskets(id) ON DELETE CASCADE,
  product_id VARCHAR(100) NULL,
  variant_id VARCHAR(100) NOT NULL,
  order_id VARCHAR(100) NULL,
  order_item_id BIGINT NULL,
  quantity INT NOT NULL DEFAULT 1,
  item_type VARCHAR(50) NOT NULL DEFAULT 'ORDER' CHECK (item_type IN ('ORDER', 'EMERGENCY', 'EXTRA', 'REPLACEMENT')),
  status VARCHAR(50) NOT NULL DEFAULT 'IN_BASKET' CHECK (status IN ('IN_BASKET', 'ALLOCATED', 'DELIVERED', 'RETURNED', 'DAMAGED', 'CANCELLED')),
  loaded_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ NULL,
  returned_at TIMESTAMPTZ NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_basket_items_basket_id ON basket_items(basket_id);
CREATE INDEX IF NOT EXISTS idx_basket_items_order ON basket_items(order_id);
CREATE INDEX IF NOT EXISTS idx_basket_items_status ON basket_items(status);
CREATE INDEX IF NOT EXISTS idx_basket_items_type ON basket_items(item_type);

-- 4. Basket Movements Audit Log Table
CREATE TABLE IF NOT EXISTS basket_movements (
  id BIGSERIAL PRIMARY KEY,
  basket_id VARCHAR(100) NOT NULL REFERENCES delivery_baskets(id) ON DELETE CASCADE,
  basket_item_id VARCHAR(100) NULL,
  user_id VARCHAR(100) NOT NULL,
  delivery_partner_id VARCHAR(100) NOT NULL,
  order_id VARCHAR(100) NULL,
  order_item_id BIGINT NULL,
  variant_id VARCHAR(100) NULL,
  quantity INT NOT NULL,
  previous_status VARCHAR(50) NULL,
  new_status VARCHAR(50) NOT NULL,
  movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('LOADED', 'DELIVERED', 'EMERGENCY_ADDED', 'EMERGENCY_USED', 'RETURNED', 'DAMAGED', 'CANCELLED', 'ADJUSTED')),
  reason TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_basket_movements_basket ON basket_movements(basket_id);
CREATE INDEX IF NOT EXISTS idx_basket_movements_partner ON basket_movements(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_basket_movements_order ON basket_movements(order_id);
