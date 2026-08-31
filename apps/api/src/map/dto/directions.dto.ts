// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : directions.dto.ts
// Description : Request contract for the Google road-routing proxy used by the
//               delivery partner app.
// ============================================================================

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from 'class-validator';

/**
 * The Routes API accepts at most 25 intermediate waypoints when waypoint order
 * is optimised, so the boundary rejects anything larger rather than letting
 * Google fail the whole request.
 */
export const MAX_INTERMEDIATE_WAYPOINTS = 25;

export class RoutePointDto {
  @IsNotEmpty()
  @IsLatitude()
  @Type(() => Number)
  lat: number;

  @IsNotEmpty()
  @IsLongitude()
  @Type(() => Number)
  lng: number;
}

export class DirectionsRequestDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => RoutePointDto)
  origin: RoutePointDto;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => RoutePointDto)
  destination: RoutePointDto;

  /** Stops between origin and destination, in the caller's current order. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_INTERMEDIATE_WAYPOINTS)
  @ValidateNested({ each: true })
  @Type(() => RoutePointDto)
  intermediates?: RoutePointDto[];

  /** Let Google reorder the intermediates for the fastest overall run. */
  @IsOptional()
  @IsBoolean()
  optimizeWaypointOrder?: boolean;

  @IsOptional()
  @IsIn(['DRIVE', 'TWO_WHEELER'])
  travelMode?: 'DRIVE' | 'TWO_WHEELER';
}
