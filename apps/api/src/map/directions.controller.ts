// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : directions.controller.ts
// Description : Road-routing endpoint for the delivery partner app.
// ============================================================================

import { Body, Controller, Header, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ROLE, Roles } from '../auth/decorators/roles.decorator';
import { DirectionsService, type DirectionsResult } from './directions.service';
import { DirectionsRequestDto } from './dto/directions.dto';

@Controller({ path: 'map', version: '1' })
export class DirectionsController {
  constructor(private readonly directions: DirectionsService) {}

  /**
   * Returns Google road geometry and the fastest visiting order for a run.
   *
   * Authenticated and role-restricted rather than `@Public()` like the rest of
   * the map proxy: every miss on the service cache is a billed Google request,
   * so an anonymous caller could run up the maps bill.
   */
  @Roles(ROLE.DELIVERY_PARTNER, ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @Throttle({ short: { limit: 60, ttl: 60_000 } })
  @Post('directions')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async computeRoute(
    @Body() body: DirectionsRequestDto,
  ): Promise<DirectionsResult> {
    return this.directions.computeRoute(body);
  }
}
