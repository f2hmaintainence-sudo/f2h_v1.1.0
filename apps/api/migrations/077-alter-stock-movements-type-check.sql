-- Migration: Replace the existing stock_movements_movement_type_check constraint
-- with one that includes 'stock_in' and 'stock_out' as valid values.

ALTER TABLE stock_movements
  DROP CONSTRAINT stock_movements_movement_type_check;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_movement_type_check
  CHECK (movement_type IN (
    'stock_in',
    'stock_out',
    'purchase',
    'production',
    'stock_transfer',
    'dispatch',
    'delivery_return',
    'customer_return',
    'stock_adjustment',
    'damage',
    'expiry',
    'opening_stock',
    'closing_stock'
  ));
