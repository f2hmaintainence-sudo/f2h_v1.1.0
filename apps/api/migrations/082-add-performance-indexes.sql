-- Migration 082: Add database indexes for query performance optimization
CREATE INDEX IF NOT EXISTS idx_api_integrations_config_active_cat ON api_integrations_config (is_active, category);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories (category_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_info_device_id ON device_information (device_id);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_ref_id ON customer_feedback (reference_id);
