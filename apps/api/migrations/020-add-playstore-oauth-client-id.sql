-- ============================================================================
-- ChronoSparkSolutions — A Software Company
-- © 2026 ChronoSparkSolutions. All rights reserved.
--
-- Project     : F2H Fresh
-- File        : 020-add-playstore-oauth-client-id.sql
-- Description : Registers the new Google Play Store Classical OAuth client ID
--               for Customer Android App.
-- ============================================================================

UPDATE public.api_integrations_config
SET config_data = config_data || jsonb_build_object(
    'androidCustomerClientId', '842214638527-v983krgkm1o45u4gutkubt1ivr5g4lv6.apps.googleusercontent.com',
    'androidCustomerPlayStoreClientId', '842214638527-v983krgkm1o45u4gutkubt1ivr5g4lv6.apps.googleusercontent.com'
),
updated_at = CURRENT_TIMESTAMP
WHERE category = 'oauth' AND config_key = 'google';
