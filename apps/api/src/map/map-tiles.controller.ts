// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : map-tiles.controller.ts
// Description : Server-side proxy for raster map tiles and Google Places API.
// ============================================================================

import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
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
   */
  @Public()
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
    const coords = this.tiles.parseCoords(z, x, y.replace(/\.png$/i, ''));
    if (!coords) throw new NotFoundException('Invalid tile coordinates');

    const tile = await this.tiles.fetchTile(coords);
    if (!tile) {
      throw new ServiceUnavailableException('Tile provider is unavailable');
    }
    res.end(tile);
  }

  /**
   * Places autocomplete proxy endpoint for Web & Mobile clients.
   * Allows searching for colonies, layouts, apartments, buildings, schools,
   * colleges, hotels, offices, restaurants, shops, landmarks, etc. in India.
   */
  @Public()
  @Throttle({ short: { limit: 150, ttl: 60_000 } })
  @Get('places/autocomplete')
  async autocomplete(@Query('input') input?: string) {
    return this.tiles.autocompletePlaces(input || '');
  }

  /**
   * Place details proxy endpoint.
   */
  @Public()
  @Throttle({ short: { limit: 150, ttl: 60_000 } })
  @Get('places/details')
  async details(@Query('place_id') placeId?: string) {
    return this.tiles.getPlaceDetails(placeId || '');
  }

  /**
   * Reverse geocode proxy endpoint with establishment/business detection.
   */
  @Public()
  @Throttle({ short: { limit: 150, ttl: 60_000 } })
  @Get('geocode')
  async geocode(@Query('lat') lat?: string, @Query('lng') lng?: string) {
    const parsedLat = parseFloat(lat || '0');
    const parsedLng = parseFloat(lng || '0');
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return { status: 'INVALID_REQUEST', results: [] };
    }
    return this.tiles.reverseGeocode(parsedLat, parsedLng);
  }
}
