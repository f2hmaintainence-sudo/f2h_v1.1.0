-- ============================================================================
-- ChronoSparkSolutions — A Software Company
-- © 2026 ChronoSparkSolutions. All rights reserved.
--
-- Project     : F2H Fresh
-- File        : 019-google-oauth-client-ids.sql
-- Description : Updates Google OAuth client ids in api_integrations_config with
--               the active Web Client ID and Android Client IDs matching the
--               newly registered Play Store signing certificates.
-- ============================================================================

UPDATE public.api_integrations_config
SET config_data = config_data || jsonb_build_object(
    'serverClientId',          '842214638527-l1fj6ut97ct6gif1rljm1c63h3k31i6r.apps.googleusercontent.com',
    'webClientId',             '842214638527-l1fj6ut97ct6gif1rljm1c63h3k31i6r.apps.googleusercontent.com',
    'androidCustomerClientId', '842214638527-55evejppqcb817c43av6383096j41ctr.apps.googleusercontent.com',
    'androidDeliveryClientId', '842214638527-c42iu170m36gqsvt9tdrds45gsjf9539.apps.googleusercontent.com'
),
updated_at = CURRENT_TIMESTAMP
WHERE category = 'oauth' AND config_key = 'google';
