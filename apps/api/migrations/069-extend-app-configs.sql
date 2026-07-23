-- Migration 069: Extend app_configs table for release management metadata
ALTER TABLE app_configs ADD COLUMN IF NOT EXISTS update_title VARCHAR(255) DEFAULT 'New Update Available';
ALTER TABLE app_configs ADD COLUMN IF NOT EXISTS release_notes TEXT DEFAULT 'Bug fixes and performance improvements.';
ALTER TABLE app_configs ADD COLUMN IF NOT EXISTS file_size VARCHAR(50) DEFAULT '0 MB';
ALTER TABLE app_configs ADD COLUMN IF NOT EXISTS build_number INTEGER DEFAULT 1;
ALTER TABLE app_configs ADD COLUMN IF NOT EXISTS published_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
