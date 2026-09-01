// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : directions.service.ts
// Description : Server-side proxy for road routing. Returns drivable,
//               road geometry and fastest stop order for the delivery partner app.
//               Multi-tier routing: Google Routes v2 -> Google Directions -> OSRM.
// ============================================================================

import { Injectable, Logger } from '@nestjs/common';
import { MapTilesService } from './map-tiles.service';
import type { DirectionsRequestDto, RoutePointDto } from './dto/directions.dto';

export interface RouteLeg {
  /** Road distance of this leg, in metres. */
  distanceMeters: number;
  /** Travel time of this leg, in seconds. */
  durationSeconds: number;
  /** Google-encoded polyline (precision 5) for this leg only. */
  polyline: string;
}

export interface DirectionsResult {
  status: 'OK' | 'ZERO_RESULTS' | 'UNAVAILABLE';
  /** Which engine answered, so clients can log routing quality. */
  provider: 'google-routes-v2' | 'google-directions' | 'osrm' | null;
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
const OSRM_ROUTER_URL =
  'https://router.project-osrm.org/route/v1/driving';

const UPSTREAM_TIMEOUT_MS = 8_000;

/**
 * Joins a leg's per-step polylines for clients. Must stay outside the encoded
 * polyline alphabet (ASCII 63-126) and in sync with the mobile decoder.
 */
export const POLYLINE_SEGMENT_SEPARATOR = ';';

const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 500;
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
   * Resolves a drivable road route through Google Directions API or OSRM fallback.
   *
   * Routes API v2 (routes.googleapis.com) is disabled on this GCP project (API_KEY_SERVICE_BLOCKED).
   * Skip it entirely and go straight to the Legacy Directions API, then OSRM.
   */
  async computeRoute(request: DirectionsRequestDto): Promise<DirectionsResult> {
    const cacheKey = this.cacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    const apiKey = await this.maps.getApiKey();

    let result: DirectionsResult = { ...UNAVAILABLE };

    // 1. Google Directions API (Legacy) — Routes API v2 is blocked on this project
    if (apiKey) {
      result = await this.viaDirectionsApi(request, apiKey);
    }

    // 2. Fallback to OSRM Driving Router if Google is unavailable
    if (result.status === 'UNAVAILABLE') {
      result = await this.viaOsrmApi(request);
    }

    if (result.status === 'OK') this.putCache(cacheKey, result);
    return result;
  }

  // ---------------------------------------------------------------------------
  // 1. Google Routes API v2
  // ---------------------------------------------------------------------------

  private async viaRoutesApi(
    request: DirectionsRequestDto,
    apiKey: string,
  ): Promise<DirectionsResult> {
    const intermediates = request.intermediates ?? [];
    const optimize = Boolean(request.optimizeWaypointOrder) && intermediates.length > 0;

    const travelMode = request.travelMode ?? 'TWO_WHEELER';
    const body: Record<string, unknown> = {
      origin: this.routesWaypoint(request.origin, false),
      destination: this.routesWaypoint(request.destination, true),
      intermediates: intermediates.map((p) => this.routesWaypoint(p, true)),
      travelMode,
      optimizeWaypointOrder: optimize,
      computeAlternativeRoutes: false,
      polylineQuality: 'HIGH_QUALITY',
      languageCode: 'en-IN',
      regionCode: 'IN',
      units: 'METRIC',
    };

    // Google Routes API v2 only supports routingPreference on DRIVE
    if (travelMode === 'DRIVE') {
      body.routingPreference = 'TRAFFIC_AWARE';
    }

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
        const errorText = await response.text().catch(() => '');
        this.logger.warn(`Routes API responded ${response.status}: ${errorText}`);
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
    if (stopover) waypoint.vehicleStopover = true;
    return waypoint;
  }

  private parseProtoDuration(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;
    const seconds = Number.parseFloat(value.replace(/s$/, ''));
    return Number.isFinite(seconds) ? seconds : 0;
  }

  // ---------------------------------------------------------------------------
  // 2. Google Directions API (Legacy)
  // ---------------------------------------------------------------------------

  private async viaDirectionsApi(
    request: DirectionsRequestDto,
    apiKey: string,
  ): Promise<DirectionsResult> {
    const intermediates = request.intermediates ?? [];
    const optimize = Boolean(request.optimizeWaypointOrder) && intermediates.length > 0;

    let googleMode = 'driving';
    if (request.travelMode === 'TWO_WHEELER') {
      googleMode = 'two_wheeler';
    } else if (request.travelMode === 'BICYCLE') {
      googleMode = 'bicycling';
    } else if (request.travelMode === 'WALK') {
      googleMode = 'walking';
    }

    const params = new URLSearchParams({
      origin: this.latLngParam(request.origin),
      destination: this.latLngParam(request.destination),
      mode: googleMode,
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
      const legs: RouteLeg[] = rawLegs.map((leg: any) => {
        let legPolyline = '';
        if (rawLegs.length === 1 && typeof route.overview_polyline?.points === 'string') {
          legPolyline = route.overview_polyline.points;
        } else if (Array.isArray(leg?.steps) && leg.steps.length > 0) {
          const legPoints: Array<[number, number]> = [];
          for (const step of leg.steps) {
            if (typeof step?.polyline?.points === 'string') {
              const stepPts = this.decodePolyline(step.polyline.points);
              if (legPoints.length > 0 && stepPts.length > 0) {
                legPoints.push(...stepPts.slice(1));
              } else {
                legPoints.push(...stepPts);
              }
            }
          }
          legPolyline =
            legPoints.length > 0
              ? this.encodePolyline(legPoints)
              : (route.overview_polyline?.points || '');
        }

        return {
          distanceMeters: Number(leg?.distance?.value) || 0,
          durationSeconds:
            Number(leg?.duration_in_traffic?.value ?? leg?.duration?.value) || 0,
          polyline: legPolyline,
        };
      });

      return {
        status: 'OK',
        provider: 'google-directions',
        distanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
        durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
        polyline: route.overview_polyline.points,
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

  // ---------------------------------------------------------------------------
  // 3. OSRM Driving Router Fallback
  // ---------------------------------------------------------------------------

  private async viaOsrmApi(
    request: DirectionsRequestDto,
  ): Promise<DirectionsResult> {
    const intermediates = request.intermediates ?? [];
    const allWaypoints = [request.origin, ...intermediates, request.destination];
    const coordsParam = allWaypoints.map((p) => `${p.lng},${p.lat}`).join(';');

    try {
      const url = `${OSRM_ROUTER_URL}/${coordsParam}?overview=full&geometries=polyline&steps=true`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'F2HFresh/1.0 (+https://f2hfresh.com)' },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`OSRM responded ${response.status}`);
        return { ...UNAVAILABLE, message: 'Routing provider error' };
      }

      const data = (await response.json()) as any;
      if (data?.code !== 'Ok' || !Array.isArray(data?.routes) || data.routes.length === 0) {
        return { ...UNAVAILABLE, message: 'OSRM returned no route' };
      }

      const route = data.routes[0];
      const polyline = route.geometry;
      if (typeof polyline !== 'string' || polyline.length === 0) {
        return { ...UNAVAILABLE, message: 'OSRM returned no road geometry' };
      }

      const rawLegs = Array.isArray(route.legs) ? route.legs : [];
      const legs: RouteLeg[] = rawLegs.map((leg: any) => ({
        distanceMeters: Number(leg?.distance) || 0,
        durationSeconds: Number(leg?.duration) || 0,
        polyline: this.joinStepPolylines(
          (leg?.steps ?? []).map((st: any) => ({ polyline: { points: st?.geometry } })),
        ),
      }));

      return {
        status: 'OK',
        provider: 'osrm',
        distanceMeters: Number(route.distance) || 0,
        durationSeconds: Number(route.duration) || 0,
        polyline,
        optimizedOrder: [],
        legs,
      };
    } catch (error) {
      this.logger.warn(`OSRM request failed: ${String(error)}`);
      return { ...UNAVAILABLE, message: 'OSRM router unreachable' };
    }
  }

  private decodePolyline(encoded: string): Array<[number, number]> {
    if (!encoded) return [];
    const points: Array<[number, number]> = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    const len = encoded.length;

    while (index < len) {
      let b: number;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push([lat / 1e5, lng / 1e5]);
    }
    return points;
  }

  private encodePolyline(points: Array<[number, number]>): string {
    let result = '';
    let prevLat = 0;
    let prevLng = 0;

    for (const [lat, lng] of points) {
      const latE5 = Math.round(lat * 1e5);
      const lngE5 = Math.round(lng * 1e5);

      const dLat = latE5 - prevLat;
      const dLng = lngE5 - prevLng;

      prevLat = latE5;
      prevLng = lngE5;

      result += this.encodeNumber(dLat) + this.encodeNumber(dLng);
    }

    return result;
  }

  private encodeNumber(num: number): string {
    let sgnNum = num < 0 ? ~(num << 1) : num << 1;
    let str = '';
    while (sgnNum >= 0x20) {
      str += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63);
      sgnNum >>= 5;
    }
    str += String.fromCharCode(sgnNum + 63);
    return str;
  }

  private joinStepPolylines(steps: unknown): string {
    if (!Array.isArray(steps)) return '';
    const encoded = steps
      .map((step: any) => step?.polyline?.points)
      .filter((points: unknown): points is string => typeof points === 'string');
    return encoded.join(POLYLINE_SEGMENT_SEPARATOR);
  }

  private latLngParam(point: RoutePointDto): string {
    return `${point.lat},${point.lng}`;
  }

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

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
      const oldest = this.cache.keys().next();
      if (!oldest.done) this.cache.delete(oldest.value);
    }
    this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  }
}
