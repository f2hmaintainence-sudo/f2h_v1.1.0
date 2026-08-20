// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : map-tiles.service.ts
// Description : Fetches and caches raster tiles, and proxies Google Places /
//               Geocoding requests for web and mobile clients.
// ============================================================================

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../shared/database/Database.service';

export interface TileCoords {
  z: number;
  x: number;
  y: number;
}

/** OSM's policy asks for a UA that identifies the app and a way to reach us. */
const USER_AGENT =
  process.env.MAP_TILE_USER_AGENT ||
  'F2HFresh/1.0 (+https://f2hfresh.com; info@f2hfresh.com)';

const DEFAULT_UPSTREAM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Tiles are immutable in practice; a week is conservative. */
const DISK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CONFIG_TTL_MS = 5 * 60 * 1000;
const MAX_ZOOM = 19;

@Injectable()
export class MapTilesService {
  private readonly logger = new Logger(MapTilesService.name);
  private readonly cacheDir =
    process.env.MAP_TILE_CACHE_DIR || path.join(process.cwd(), '.tile-cache');
  private upstream: { value: string; expiresAt: number } | null = null;

  constructor(private readonly db: DatabaseService) {}

  /**
   * Rejects anything that is not a real tile coordinate. Beyond validation this
   * is the guard that keeps `{z}/{x}/{y}` from being used to reach an arbitrary
   * path on the upstream host.
   */
  parseCoords(z: string, x: string, y: string): TileCoords | null {
    const nums = [z, x, y].map((raw) => Number.parseInt(raw, 10));
    if (nums.some((n) => !Number.isInteger(n) || n < 0)) return null;

    const [zoom, tileX, tileY] = nums;
    if (zoom > MAX_ZOOM) return null;

    // At zoom z the grid is 2^z on a side.
    const limit = 2 ** zoom;
    if (tileX >= limit || tileY >= limit) return null;

    return { z: zoom, x: tileX, y: tileY };
  }

  /** Upstream template, from `maps:google_maps.tileUrlTemplate` when set. */
  private async resolveUpstream(): Promise<string> {
    if (this.upstream && this.upstream.expiresAt > Date.now()) {
      return this.upstream.value;
    }
    let template = process.env.MAP_TILE_UPSTREAM || DEFAULT_UPSTREAM;
    try {
      const rows = await this.db.query(
        `SELECT config_data ->> 'upstreamTileUrl' AS upstream
           FROM api_integrations_config
          WHERE category = 'maps' AND is_active = true AND deleted_at IS NULL
          LIMIT 1`,
      );
      const configured = rows?.[0]?.upstream;
      if (typeof configured === 'string' && configured.includes('{z}')) {
        template = configured;
      }
    } catch (error) {
      this.logger.warn(`Tile upstream lookup failed: ${String(error)}`);
    }
    this.upstream = { value: template, expiresAt: Date.now() + CONFIG_TTL_MS };
    return template;
  }

  private cachePath({ z, x, y }: TileCoords): string {
    return path.join(this.cacheDir, String(z), String(x), `${y}.png`);
  }

  private readCached(coords: TileCoords): Buffer | null {
    try {
      const file = this.cachePath(coords);
      const stat = fs.statSync(file);
      if (Date.now() - stat.mtimeMs > DISK_TTL_MS) return null;
      return fs.readFileSync(file);
    } catch {
      return null; // a cache miss is the common case, not an error
    }
  }

  private writeCached(coords: TileCoords, data: Buffer): void {
    try {
      const file = this.cachePath(coords);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, data);
    } catch (error) {
      // A cache that cannot be written must not fail the request.
      this.logger.warn(`Tile cache write failed: ${String(error)}`);
    }
  }

  /**
   * Returns the tile bytes, from disk when possible.
   *
   * Caching is not just a speed optimisation here: serving repeat views from
   * disk is what keeps the upstream request volume within OSM's policy.
   */
  async fetchTile(coords: TileCoords): Promise<Buffer | null> {
    const cached = this.readCached(coords);
    if (cached) return cached;

    const template = await this.resolveUpstream();
    const url = template
      .replace('{z}', String(coords.z))
      .replace('{x}', String(coords.x))
      .replace('{y}', String(coords.y));

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'image/png,image/*' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        this.logger.warn(`Tile upstream responded ${response.status} for ${url}`);
        return null;
      }
      const data = Buffer.from(await response.arrayBuffer());
      this.writeCached(coords, data);
      return data;
    } catch (error) {
      this.logger.warn(`Tile fetch failed for ${url}: ${String(error)}`);
      return null;
    }
  }

  /**
   * Retrieves Google Maps API key from DB configuration or fallback.
   */
  async getApiKey(): Promise<string> {
    try {
      const rows = await this.db.query(
        `SELECT config_data ->> 'apiKey' AS api_key
           FROM api_integrations_config
          WHERE category = 'maps' AND is_active = true AND deleted_at IS NULL
          LIMIT 1`,
      );
      const configured = rows?.[0]?.api_key;
      if (typeof configured === 'string' && configured.trim().length > 0) {
        return configured.trim();
      }
    } catch (error) {
      this.logger.warn(`Maps apiKey lookup failed: ${String(error)}`);
    }
    return (
      process.env.GOOGLE_MAPS_API_KEY ||
      'AIzaSyDPzNGpuT5QHHdCmlKAogNkDJj1e34urbs'
    );
  }

  /**
   * Google Places Autocomplete proxy with India country restriction.
   * Allows searching for colonies, layouts, apartments, buildings, schools,
   * colleges, hotels, offices, restaurants, shops, landmarks, IT parks, areas, etc.
   */
  async autocompletePlaces(input: string) {
    if (!input || input.trim().length === 0) {
      return { predictions: [], status: 'OK' };
    }
    const query = input.trim();
    const apiKey = await this.getApiKey();

    if (apiKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          query,
        )}&components=country:in&key=${apiKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data && data.status === 'OK' && Array.isArray(data.predictions)) {
            return {
              status: 'OK',
              predictions: data.predictions.map((p: any) => ({
                place_id: p.place_id,
                description: p.description,
                main_text: p.structured_formatting?.main_text || p.description,
                secondary_text: p.structured_formatting?.secondary_text || '',
                types: p.types || [],
              })),
            };
          }
        }
      } catch (err) {
        this.logger.warn(`Google Places Autocomplete failed: ${String(err)}`);
      }
    }

    // Fallback: OpenStreetMap Nominatim
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query,
      )}&countrycodes=in&limit=10&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = (await res.json()) as any[];
        if (Array.isArray(data)) {
          return {
            status: 'OK',
            predictions: data.map((item: any) => ({
              place_id: `osm-${item.place_id || item.osm_id}`,
              description: item.display_name,
              main_text: item.name || item.display_name.split(',')[0] || '',
              secondary_text: item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              types: [item.type, item.class].filter(Boolean),
              raw_address: item.address,
            })),
          };
        }
      }
    } catch (err) {
      this.logger.warn(`Nominatim search fallback failed: ${String(err)}`);
    }

    return { predictions: [], status: 'ZERO_RESULTS' };
  }

  /**
   * Google Place Details proxy to retrieve coordinates and full address components.
   */
  async getPlaceDetails(placeId: string) {
    if (!placeId) {
      return { result: null, status: 'INVALID_REQUEST' };
    }
    const apiKey = await this.getApiKey();

    if (apiKey && !placeId.startsWith('osm-')) {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
          placeId,
        )}&fields=name,geometry,address_components,formatted_address,types&key=${apiKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data && data.status === 'OK' && data.result) {
            return {
              status: 'OK',
              result: data.result,
            };
          }
        }
      } catch (err) {
        this.logger.warn(`Google Place Details failed: ${String(err)}`);
      }
    }

    return { result: null, status: 'NOT_FOUND' };
  }

  /**
   * Reverse geocoding proxy with business/establishment detection.
   */
  async reverseGeocode(lat: number, lng: number) {
    const apiKey = await this.getApiKey();

    if (apiKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&region=in&key=${apiKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data && data.status === 'OK' && Array.isArray(data.results)) {
            // Find establishment / point of interest / business name if available
            let businessName = '';
            for (const r of data.results) {
              const types = Array.isArray(r.types) ? r.types : [];
              if (
                types.includes('establishment') ||
                types.includes('point_of_interest') ||
                types.includes('premise') ||
                types.includes('store') ||
                types.includes('restaurant') ||
                types.includes('school') ||
                types.includes('hospital')
              ) {
                const firstComp = r.address_components?.[0]?.long_name;
                if (firstComp && !firstComp.match(/^\d+$/)) {
                  businessName = firstComp;
                  break;
                }
              }
            }

            return {
              status: 'OK',
              results: data.results,
              business_name: businessName,
            };
          }
        }
      } catch (err) {
        this.logger.warn(`Google Reverse Geocoding failed: ${String(err)}`);
      }
    }

    // Fallback: Nominatim reverse
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data && data.address) {
          const name = data.name || data.display_name?.split(',')[0] || '';
          return {
            status: 'OK',
            results: [
              {
                formatted_address: data.display_name,
                address_components: [],
                geometry: {
                  location: { lat, lng },
                },
                raw_address: data.address,
              },
            ],
            business_name: name,
          };
        }
      }
    } catch (err) {
      this.logger.warn(`Nominatim reverse fallback failed: ${String(err)}`);
    }

    return { results: [], status: 'ZERO_RESULTS', business_name: '' };
  }
}
