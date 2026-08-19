// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : map-tiles.service.ts
// Description : Fetches and caches raster tiles from the configured upstream.
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
}
