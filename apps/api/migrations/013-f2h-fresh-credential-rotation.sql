-- ============================================================================
-- ChronoSparkSolutions — A Software Company
-- © 2026 ChronoSparkSolutions. All rights reserved.
--
-- Project     : F2H Fresh
-- File        : 013-f2h-fresh-credential-rotation.sql
-- Description : Moves every client-facing Google/Firebase credential from the
--               retired `f2hfresh-65beb` project (number 277443632535) to
--               `f2h-fresh` (number 842214638527).
--
--               Supersedes the values seeded by 005-client-auth-config.sql.
--               That file is left as-is: migrations are history, not state.
--
--               Everything below is client-public — these rows are served
--               verbatim to the mobile apps by GET /api/v1/device/client-config,
--               so no client secret and no service-account key may be added
--               here. The Firebase Admin private key is loaded separately by
--               `apps/api/scripts/seed-firebase-admin.mjs`, which reads the
--               untracked key file.
-- ============================================================================

-- ── Google Sign-In ──────────────────────────────────────────────────────────
-- `serverClientId` is the WEB OAuth client on every platform: the Android and
-- iOS apps exchange their serverAuthCode against it so the API only ever has to
-- verify one audience. The platform ids are recorded for reference and for the
-- API's GOOGLE_ANDROID_CLIENT_ID / GOOGLE_IOS_CLIENT_ID allow-list.
INSERT INTO public.api_integrations_config
    (category, config_key, name, provider, is_active, config_data)
VALUES (
    'oauth',
    'google',
    'Google Sign-In (OAuth)',
    'google',
    true,
    jsonb_build_object(
        'serverClientId',    '842214638527-0hdom5v6ab9aum1jrn86treomqqhmm7m.apps.googleusercontent.com',
        'webClientId',       '842214638527-0hdom5v6ab9aum1jrn86treomqqhmm7m.apps.googleusercontent.com',
        'androidCustomerClientId', '842214638527-55evejppqcb817c43av6383096j41ctr.apps.googleusercontent.com',
        'androidDeliveryClientId', '842214638527-c42iu170m36gqsvt9tdrds45gsjf9539.apps.googleusercontent.com',
        'iosCustomerClientId',     '842214638527-nsuc18j2kbgqq5gu900lommpgk87tk4n.apps.googleusercontent.com',
        'iosDeliveryClientId',     '842214638527-kdqkno564i19tpbr4348i0jjddd7he0f.apps.googleusercontent.com'
    )
)
ON CONFLICT (category, config_key) DO UPDATE
SET name        = EXCLUDED.name,
    provider    = EXCLUDED.provider,
    is_active   = true,
    config_data = public.api_integrations_config.config_data || EXCLUDED.config_data,
    updated_at  = CURRENT_TIMESTAMP;

-- ── Google Maps ─────────────────────────────────────────────────────────────
INSERT INTO public.api_integrations_config
    (category, config_key, name, provider, is_active, config_data)
VALUES (
    'maps',
    'google_maps',
    'Google Maps',
    'google',
    true,
    jsonb_build_object('apiKey', 'AIzaSyDPzNGpuT5QHHdCmlKAogNkDJj1e34urbs')
)
ON CONFLICT (category, config_key) DO UPDATE
SET name        = EXCLUDED.name,
    provider    = EXCLUDED.provider,
    is_active   = true,
    config_data = public.api_integrations_config.config_data || EXCLUDED.config_data,
    updated_at  = CURRENT_TIMESTAMP;

-- ── Firebase client config, per app ─────────────────────────────────────────
-- Values mirror android/app/google-services.json exactly; a mismatch makes
-- Firebase.initializeApp fail on the device.
INSERT INTO public.api_integrations_config
    (category, config_key, name, provider, is_active, config_data)
VALUES
    ('firebase', 'customer', 'Firebase — Customer App', 'google', true,
     jsonb_build_object(
        'apiKey',            'AIzaSyAM1WRkJSfx4PTbuIkl4w4A09mCSH777js',
        'appId',             '1:842214638527:android:1800c0a5729eb74823d70a',
        'messagingSenderId', '842214638527',
        'projectId',         'f2h-fresh',
        'storageBucket',     'f2h-fresh.firebasestorage.app',
        'authDomain',        'f2h-fresh.firebaseapp.com',
        'iosBundleId',       'com.f2h.customer'
     )),
    ('firebase', 'delivery', 'Firebase — Delivery App', 'google', true,
     jsonb_build_object(
        'apiKey',            'AIzaSyAM1WRkJSfx4PTbuIkl4w4A09mCSH777js',
        'appId',             '1:842214638527:android:48141f5c3bf1127123d70a',
        'messagingSenderId', '842214638527',
        'projectId',         'f2h-fresh',
        'storageBucket',     'f2h-fresh.firebasestorage.app',
        'authDomain',        'f2h-fresh.firebaseapp.com',
        'iosBundleId',       'com.f2h.delivery'
     )),
    ('firebase', 'client', 'Firebase — Default Client', 'google', true,
     jsonb_build_object(
        'apiKey',            'AIzaSyAM1WRkJSfx4PTbuIkl4w4A09mCSH777js',
        'appId',             '1:842214638527:android:1800c0a5729eb74823d70a',
        'messagingSenderId', '842214638527',
        'projectId',         'f2h-fresh',
        'storageBucket',     'f2h-fresh.firebasestorage.app',
        'authDomain',        'f2h-fresh.firebaseapp.com',
        'iosBundleId',       'com.f2h.customer'
     ))
ON CONFLICT (category, config_key) DO UPDATE
SET name        = EXCLUDED.name,
    provider    = EXCLUDED.provider,
    is_active   = true,
    config_data = public.api_integrations_config.config_data || EXCLUDED.config_data,
    updated_at  = CURRENT_TIMESTAMP;

-- ── Drop the stale iOS keys 005 wrote ───────────────────────────────────────
-- `f2h-fresh` has no iOS app registered. The old ids belonged to yet another
-- project, so serving them would break Firebase.initializeApp on iOS rather
-- than merely leaving it unconfigured. `-` on a jsonb removes the key entirely,
-- which is what lets the API fall through to an empty string.
UPDATE public.api_integrations_config
SET config_data = config_data - 'iosApiKey' - 'iosAppId',
    updated_at  = CURRENT_TIMESTAMP
WHERE category = 'firebase';
