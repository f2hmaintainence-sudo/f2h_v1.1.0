// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : directions.service.ts
// Description : Server-side proxy for Google road routing. Returns drivable,
//               traffic-aware road geometry and the fastest stop order for the
//               delivery partner app.
// ============================================================================

import { Injectable, Logger } from '@nestjs/common';
import { MapTilesService } from './map-tiles.service';
import type { DirectionsRequestDto, RoutePointDto } from './dto/directions.dto';

export interface RouteLeg {
  /** Road distance of this leg, in metres, as measured by Google. */
  distanceMeters: number;
  /** Travel time of this leg, in seconds, traffic-aware where available. */
  durationSeconds: number;
  /** Google-encoded polyline (precision 5) for this leg only. */
  polyline: string;
}

export interface DirectionsResult {
  status: 'OK' | 'ZERO_RESULTS' | 'UNAVAILABLE';
  /** Which Google engine answered, so clients can log routing quality. */
  provider: 'google-routes-v2' | 'google-directions' | null;
  distanceMeters: number;
  durationSeconds: number;
  /** Google-encoded polyline (precision 5) for the whole route. */
  polyline: string;
  /**
   * Original intermediate indices in the order they should be visited.
   * `[1, 2, 0]` means: visit intermediate 1, then 2, then 0. Empty when the
   * caller did not ask for optimisation.
   */
  optimizedOrder: number[];
  legs: RouteLeg[];
  message?: string;
}

const ROUTES_API_URL =
  'https://routes.googleapis.com/directions/v2:computeRoutes';
const DIRECTIONS_API_URL =
  'https://maps.googleapis.com/maps/api/directions/json';

const UPSTREAM_TIMEOUT_MS = 8_000;

/**
 * A rider's screen recomputes on rebuild, on location tap and on every order
 * status change; without this the same route would be billed several times a
 * minute. Short enough that live traffic still moves the ETA.
 */
const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 500;

/** ~1 m of positional resolution — finer than that is GPS noise, not a new route. */
const CACHE_COORD_PRECISION = 5;

const UNAVAILABLE: DirectionsResult = {
  status: 'UNAVAILABLE',
  provider: null,
  distanceMeters: 0,
  durationSeconds: 0,
  polyline: '',
  optimizedOrder: [],
  legs: [],
};

@Injectable()
export class DirectionsService {
  private readonly logger = new Logger(DirectionsService.name);
  private readonly cache = new Map<
    string,
    { expiresAt: number; result: DirectionsResult }
  >();

  constructor(private readonly maps: MapTilesService) {}

  /**
   * Resolves a drivable route through Google.
   *
   * Routes API v2 is preferred — it is the engine that returns traffic-aware
   * durations and optimised waypoint order in one call. The legacy Directions
   * API is tried second because a project may only have that one enabled; it is
   * the same road network, so a fallback still satisfies "road geometry from
   * Google". There is deliberately no local fallback: a straight line between
   * two points is not a driving route, and returning one would put a road the
   * rider cannot take on the map.
   */
  async computeRoute(request: DirectionsRequestDto): Promise<DirectionsResult> {
    const cacheKey = this.cacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    const apiKey = await this.maps.getApiKey();
    if (!apiKey) {
      this.logger.error('No Google Maps API key configured; cannot route');
      return { ...UNAVAILABLE, message: 'Routing is not configured' };
    }

    let result = await this.viaRoutesApi(request, apiKey);
    if (result.status !== 'OK') {
      const legacy = await this.viaDirectionsApi(request, apiKey);
      // Keep the Routes API answer when it was a definitive "no route exists".
      if (legacy.status === 'OK' || result.status === 'UNAVAILABLE') {
        result = legacy;
      }
    }

    if (result.status === 'OK') this.putCache(cacheKey, result);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Routes API v2
  // ---------------------------------------------------------------------------

  private async viaRoutesApi(
    request: DirectionsRequestDto,
    apiKey: string,
  ): Promise<DirectionsResult> {
    const intermediates = request.intermediates ?? [];
    const optimize = Boolean(request.optimizeWaypointOrder) && intermediates.length > 1;

    const body = {
      origin: this.routesWaypoint(request.origin, false),
      destination: this.routesWaypoint(request.destination, true),
      intermediates: intermediates.map((p) => this.routesWaypoint(p, true)),
      travelMode: request.travelMode ?? 'TWO_WHEELER',
      // Live traffic is what makes the returned order the *fastest* one rather
      // than merely the shortest.
      routingPreference: 'TRAFFIC_AWARE',
      optimizeWaypointOrder: optimize,
      computeAlternativeRoutes: false,
      polylineQuality: 'HIGH_QUALITY',
      languageCode: 'en-IN',
      regionCode: 'IN',
      units: 'METRIC',
    };

    const fieldMask = [
      'routes.duration',
      'routes.distanceMeters',
      'routes.polyline.encodedPolyline',
      'routes.legs.duration',
      'routes.legs.distanceMeters',
      'routes.legs.polyline.encodedPolyline',
      'routes.optimizedIntermediateWaypointIndex',
    ].join(',');

    try {
      const response = await fetch(ROUTES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      if (!response.ok) {
        // The upstream body can echo the API key back in error text, so only
        // the status is logged.
        this.logger.warn(`Routes API responded ${response.status}`);
        return { ...UNAVAILABLE, message: 'Routing provider error' };
      }

      const data = (await response.json()) as any;
      const route = Array.isArray(data?.routes) ? data.routes[0] : null;
      if (!route) {
        return {
          ...UNAVAILABLE,
          status: 'ZERO_RESULTS',
          message: 'No drivable route between these stops',
        };
      }

      const polyline = route.polyline?.encodedPolyline;
      if (typeof polyline !== 'string' || polyline.length === 0) {
        return { ...UNAVAILABLE, message: 'Routing provider returned no geometry' };
      }

      const legs: RouteLeg[] = (Array.isArray(route.legs) ? route.legs : []).map(
        (leg: any) => ({
          distanceMeters: Number(leg?.distanceMeters) || 0,
          durationSeconds: this.parseProtoDuration(leg?.duration),
          polyline: leg?.polyline?.encodedPolyline ?? '',
        }),
      );

      const rawOrder = route.optimizedIntermediateWaypointIndex;
      return {
        status: 'OK',
        provider: 'google-routes-v2',
        distanceMeters: Number(route.distanceMeters) || 0,
        durationSeconds: this.parseProtoDuration(route.duration),
        polyline,
        optimizedOrder: this.sanitizeOrder(rawOrder, intermediates.length),
        legs,
      };
    } catch (error) {
      this.logger.warn(`Routes API request failed: ${String(error)}`);
      return { ...UNAVAILABLE, message: 'Routing provider unreachable' };
    }
  }

  private routesWaypoint(point: RoutePointDto, stopover: boolean) {
    const waypoint: Record<string, unknown> = {
      location: {
        latLng: { latitude: point.lat, longitude: point.lng },
      },
    };
    // Tells Google the rider actually parks here, so it routes to the kerb side
    // rather than to the nearest point on the road.
    if (stopover) waypoint.vehicleStopover = true;
    return waypoint;
  }

  /** Routes API returns durations as protobuf strings such as `"432s"`. */
  private parseProtoDuration(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;
    const seconds = Number.parseFloat(value.replace(/s$/, ''));
    return Number.isFinite(seconds) ? seconds : 0;
  }

  // ---------------------------------------------------------------------------
  // Legacy Directions API
  // ---------------------------------------------------------------------------

  private async viaDirectionsApi(
    request: DirectionsRequestDto,
    apiKey: string,
  ): Promise<DirectionsResult> {
    const intermediates = request.intermediates ?? [];
    const optimize = Boolean(request.optimizeWaypointOrder) && intermediates.length > 1;

    const params = new URLSearchParams({
      origin: this.latLngParam(request.origin),
      destination: this.latLngParam(request.destination),
      mode: 'driving',
      // Without this the API returns free-flow times, not traffic-aware ones.
      departure_time: 'now',
      region: 'in',
      units: 'metric',
      key: apiKey,
    });

    if (intermediates.length > 0) {
      const points = intermediates.map((p) => this.latLngParam(p));
      params.set(
        'waypoints',
        (optimize ? ['optimize:true', ...points] : points).join('|'),
      );
    }

    try {
      const response = await fetch(`${DIRECTIONS_API_URL}?${params.toString()}`, {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(`Directions API responded ${response.status}`);
        return { ...UNAVAILABLE, message: 'Routing provider error' };
      }

      const data = (await response.json()) as any;
      if (data?.status === 'ZERO_RESULTS') {
        return {
          ...UNAVAILABLE,
          status: 'ZERO_RESULTS',
          message: 'No drivable route between these stops',
        };
      }
      const route = data?.status === 'OK' ? data?.routes?.[0] : null;
      const polyline = route?.overview_polyline?.points;
      if (!route || typeof polyline !== 'string' || polyline.length === 0) {
        this.logger.warn(`Directions API status ${String(data?.status)}`);
        return { ...UNAVAILABLE, message: 'Routing provider error' };
      }

      const rawLegs = Array.isArray(route.legs) ? route.legs : [];
      const legs: RouteLeg[] = rawLegs.map((leg: any) => ({
        distanceMeters: Number(leg?.distance?.value) || 0,
        // duration_in_traffic is only present with departure_time set.
        durationSeconds:
          Number(leg?.duration_in_traffic?.value ?? leg?.duration?.value) || 0,
        // Legacy responses carry geometry per step, not per leg.
        polyline: this.joinStepPolylines(leg?.steps),
      }));

      return {
        status: 'OK',
        provider: 'google-directions',
        distanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
        durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
        polyline,
        optimizedOrder: this.sanitizeOrder(
          route.waypoint_order,
          intermediates.length,
        ),
        legs,
      };
    } catch (error) {
      this.logger.warn(`Directions API request failed: ${String(error)}`);
      return { ...UNAVAILABLE, message: 'Routing provider unreachable' };
    }
  }

  /**
   * Concatenates a leg's step geometries into one encoded polyline. Steps are
   * already encoded, and each starts where the previous ended, so decoding and
   * re-encoding would only lose precision — the client stitches the decoded
   * point lists instead, and this preserves the step boundaries it needs.
   */
  private joinStepPolylines(steps: unknown): string {
    if (!Array.isArray(steps)) return '';
    const encoded = steps
      .map((step: any) => step?.polyline?.points)
      .filter((points: unknown): points is string => typeof points === 'string');
    return encoded.join('|');
  }

  private latLngParam(point: RoutePointDto): string {
    return `${point.lat},${point.lng}`;
  }

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  /**
   * Google returns the optimised sequence as original-waypoint indices. A
   * malformed or partial list would silently drop or duplicate a customer's
   * stop, so anything that is not a complete permutation is discarded and the
   * caller keeps its own order.
   */
  private sanitizeOrder(raw: unknown, expectedLength: number): number[] {
    if (!Array.isArray(raw) || raw.length !== expectedLength) return [];
    const seen = new Set<number>();
    for (const value of raw) {
      const index = Number(value);
      if (!Number.isInteger(index) || index < 0 || index >= expectedLength) {
        return [];
      }
      if (seen.has(index)) return [];
      seen.add(index);
    }
    return raw.map((value) => Number(value));
  }

  private cacheKey(request: DirectionsRequestDto): string {
    const point = (p: RoutePointDto) =>
      `${p.lat.toFixed(CACHE_COORD_PRECISION)},${p.lng.toFixed(CACHE_COORD_PRECISION)}`;
    return [
      point(request.origin),
      point(request.destination),
      (request.intermediates ?? []).map(point).join(';'),
      request.travelMode ?? 'TWO_WHEELER',
      request.optimizeWaypointOrder ? 'opt' : 'fixed',
    ].join('|');
  }

  private putCache(key: string, result: DirectionsResult): void {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      // Map iterates in insertion order, so this drops the oldest entry.
      const oldest = this.cache.keys().next();
      if (!oldest.done) this.cache.delete(oldest.value);
    }
    this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  }
}
