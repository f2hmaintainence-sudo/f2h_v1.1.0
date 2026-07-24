CREATE TABLE "order_items" (
  id INT PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,

  variant_id VARCHAR(30) DEFAULT NULL,
  
  subscription_item_id VARCHAR(30) DEFAULT NULL,

  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,

  unit_price NUMERIC(10,2) NOT NULL,

  discount_id VARCHAR(30),

  coupon_id VARCHAR(30),

  discount_amount NUMERIC(10,2) DEFAULT 0,

  coupon_amount NUMERIC(10,2) DEFAULT 0,

  final_price NUMERIC(10,2),

  is_free BOOLEAN NOT NULL DEFAULT false,
  
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP
);
