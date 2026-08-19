// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : map-tiles.controller.ts
// Description : Server-side proxy for raster map tiles.
//
//               The apps used to fetch tile.openstreetmap.org straight from the
//               device. That breaks in two ways: OpenStreetMap's usage policy
//               requires an identifying User-Agent and caching (a browser can
//               supply neither — Flutter web ignores `userAgentPackageName`
//               because the browser owns that header), and every device hits OSM
//               with its own IP, so a busy fleet gets rate-blocked per-network
//               and the map fills with "Access blocked" tiles.
//
//               Routing tiles through here means one identified client, one
//               cache, and one place to swap providers.
// ============================================================================

import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { MapTilesService } from './map-tiles.service';

@Controller({ path: 'map', version: '1' })
export class MapTilesController {
  constructor(private readonly tiles: MapTilesService) {}

  /**
   * A single 256px raster tile.
   *
   * `z/x/y` are parsed as integers and range-checked before they reach the
   * upstream URL — they are path segments on a third-party host, so anything
   * less would be a request-forgery hole.
   */
  @Public()
  // A map view pulls tens of tiles at once, so the ceiling is high; it exists to
  // stop a scraper walking the whole pyramid through us.
  @Throttle({ short: { limit: 300, ttl: 60_000 } })
  @Get('tiles/:z/:x/:y')
  @Header('Cache-Control', 'public, max-age=604800, immutable')
  @Header('Content-Type', 'image/png')
  async tile(
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Res() res: Response,
  ): Promise<void> {
    // `y` arrives as "1972" or "1972.png" depending on the client.
    const coords = this.tiles.parseCoords(z, x, y.replace(/\.png$/i, ''));
    if (!coords) throw new NotFoundException('Invalid tile coordinates');

    const tile = await this.tiles.fetchTile(coords);
    if (!tile) {
      throw new ServiceUnavailableException('Tile provider is unavailable');
    }
    res.end(tile);
  }
}
