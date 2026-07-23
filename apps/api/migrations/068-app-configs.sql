CREATE TABLE IF NOT EXISTS app_configs (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL UNIQUE,       -- 'android_customer', 'ios_customer', 'android_delivery', 'ios_delivery'
    latest_version VARCHAR(20) NOT NULL,        -- e.g. '1.0.1+8'
    min_version VARCHAR(20) NOT NULL,           -- e.g. '1.0.0+1' (Force update if below this)
    force_update BOOLEAN DEFAULT FALSE,         -- Master flag
    store_url VARCHAR(255) NOT NULL,            -- Download URL
    update_message TEXT,                        -- Custom prompt string
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_configs (platform, latest_version, min_version, force_update, store_url, update_message)
VALUES 
('android_customer', '1.0.1+8', '1.0.0+1', true, 'https://dev.f2hfresh.com/appapk', 'A critical update is available. Please update the customer app to continue.'),
('android_delivery', '1.0.0+1', '1.0.0+1', false, 'https://dev.f2hfresh.com/deliveryapk', 'New enhancements are available for our delivery partners.')
ON CONFLICT (platform) DO UPDATE SET 
  latest_version = EXCLUDED.latest_version,
  min_version = EXCLUDED.min_version,
  force_update = EXCLUDED.force_update,
  store_url = EXCLUDED.store_url,
  update_message = EXCLUDED.update_message,
  updated_at = NOW();
