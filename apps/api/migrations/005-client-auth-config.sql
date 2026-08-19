-- ============================================================================
-- ChronoSparkSolutions — A Software Company
-- © 2026 ChronoSparkSolutions. All rights reserved.
--
-- Project     : F2H Fresh
-- File        : 005-client-auth-config.sql
-- Description : Makes the mobile/web clients fully server-driven for auth.
--               The apps previously fell back to Firebase and Google OAuth
--               credentials compiled into the binary; these rows move that
--               configuration into the database so it is editable from
--               Admin → Developer → API Integrations and rotatable without a
--               rebuild.
-- ============================================================================

-- ── Google OAuth (Sign in with Google) ──────────────────────────────────────
-- `serverClientId` is the Web-type OAuth client. Android/iOS exchange their
-- serverAuthCode against it, so the SAME id is used on every platform.
INSERT INTO public.api_integrations_config
    (category, config_key, name, provider, is_active, config_data)
VALUES (
    'oauth',
    'google',
    'Google Sign-In (OAuth)',
    'google',
    true,
    jsonb_build_object(
        'serverClientId', '605526160181-00mmui7o3uuijjgvhgjjs5qbldai544g.apps.googleusercontent.com',
        'webClientId',    '605526160181-00mmui7o3uuijjgvhgjjs5qbldai544g.apps.googleusercontent.com'
    )
)
ON CONFLICT (category, config_key) DO UPDATE
SET name        = EXCLUDED.name,
    provider    = EXCLUDED.provider,
    is_active   = true,
    config_data = public.api_integrations_config.config_data || EXCLUDED.config_data,
    updated_at  = CURRENT_TIMESTAMP;

-- ── Firebase: add the iOS keys the customer row was missing ─────────────────
-- Without these the API served hardcoded iOS defaults from app.controller.ts.
UPDATE public.api_integrations_config
SET config_data = config_data || jsonb_build_object(
        'iosApiKey',   'AIzaSyBR4Xs71YQTs8Hzlp5Ql5a15ZxD2FfzGxg',
        'iosAppId',    '1:1060833982707:ios:64708d0f2c64294ef31f86',
        'iosBundleId', 'com.f2h.customer'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE category = 'firebase' AND config_key = 'customer';

UPDATE public.api_integrations_config
SET config_data = config_data || jsonb_build_object(
        'iosApiKey',   'AIzaSyAtT56n3QZdD7ZFYyXOwVPlFoLEuVkkOFk',
        'iosAppId',    '1:445665408019:ios:8b7b36e7cca52b2d59fbe6',
        'iosBundleId', 'com.f2h.delivery'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE category = 'firebase' AND config_key = 'delivery';
