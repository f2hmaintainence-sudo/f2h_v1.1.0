-- ============================================================================
-- ChronoSparkSolutions — A Software Company
-- © 2026 ChronoSparkSolutions. All rights reserved.
--
-- Project     : F2H Fresh
-- File        : 015-map-tile-source.sql
-- Description : Moves the map tile source into api_integrations_config.
--
--               The apps had `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
--               compiled in and fetched it from every device. OpenStreetMap
--               rate-blocks clients that do this, which is what filled the
--               delivery map with "Access blocked" tiles.
--
--               `tileUrlTemplate` is what the clients render; it points at our
--               own proxy (GET /api/v1/map/tiles/{z}/{x}/{y}), which fetches
--               `upstreamTileUrl` server-side with an identifying User-Agent and
--               caches the result. Swapping to a commercial provider later is an
--               edit to `upstreamTileUrl` alone.
-- ============================================================================

UPDATE public.api_integrations_config
SET config_data = config_data || jsonb_build_object(
        'tileUrlTemplate',  'https://f2hfresh.com/api/v1/map/tiles/{z}/{x}/{y}',
        'upstreamTileUrl',  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        'tileAttribution',  '© OpenStreetMap contributors'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE category = 'maps' AND config_key = 'google_maps';
