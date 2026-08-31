import { Logger } from '@nestjs/common';
import { DirectionsService } from './directions.service';
import type { MapTilesService } from './map-tiles.service';
import type { DirectionsRequestDto } from './dto/directions.dto';

/**
 * `_p~iF~ps|U_ulLnnqC_mqNvxq`@` is the worked example from Google's Encoded
 * Polyline Algorithm Format documentation.
 */
const POLYLINE = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

const request = (
  overrides: Partial<DirectionsRequestDto> = {},
): DirectionsRequestDto => ({
  origin: { lat: 12.7429, lng: 78.345 },
  destination: { lat: 12.753, lng: 78.351 },
  intermediates: [
    { lat: 12.748, lng: 78.34 },
    { lat: 12.746, lng: 78.356 },
  ],
  optimizeWaypointOrder: true,
  travelMode: 'TWO_WHEELER',
  ...overrides,
});

const routesApiOk = (route: Record<string, unknown> = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({
    routes: [
      {
        distanceMeters: 2543,
        duration: '432s',
        polyline: { encodedPolyline: POLYLINE },
        optimizedIntermediateWaypointIndex: [1, 0],
        legs: [
          {
            distanceMeters: 900,
            duration: '150s',
            polyline: { encodedPolyline: POLYLINE },
          },
          {
            distanceMeters: 1643,
            duration: '282s',
            polyline: { encodedPolyline: POLYLINE },
          },
        ],
        ...route,
      },
    ],
  }),
});

const upstreamError = (status = 403) => ({
  ok: false,
  status,
  json: async () => ({ error: { message: 'nope' } }),
});

describe('DirectionsService', () => {
  let service: DirectionsService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const maps = { getApiKey: jest.fn().mockResolvedValue('test-key') };
    service = new DirectionsService(maps as unknown as MapTilesService);

    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => jest.restoreAllMocks());

  it('maps a Routes API response into road geometry, totals and stop order', async () => {
    fetchMock.mockResolvedValueOnce(routesApiOk());

    const result = await service.computeRoute(request());

    expect(result.status).toBe('OK');
    expect(result.provider).toBe('google-routes-v2');
    expect(result.distanceMeters).toBe(2543);
    expect(result.durationSeconds).toBe(432);
    expect(result.polyline).toBe(POLYLINE);
    expect(result.optimizedOrder).toEqual([1, 0]);
    expect(result.legs).toHaveLength(2);
    expect(result.legs[0]).toEqual({
      distanceMeters: 900,
      durationSeconds: 150,
      polyline: POLYLINE,
    });
  });

  it('asks Google for a traffic-aware, order-optimised two-wheeler route', async () => {
    fetchMock.mockResolvedValueOnce(routesApiOk());

    await service.computeRoute(request());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('routes.googleapis.com');
    const body = JSON.parse(init.body);
    expect(body.travelMode).toBe('TWO_WHEELER');
    expect(body.routingPreference).toBe('TRAFFIC_AWARE');
    expect(body.optimizeWaypointOrder).toBe(true);
    expect(body.intermediates).toHaveLength(2);
    expect(init.headers['X-Goog-Api-Key']).toBe('test-key');
  });

  it('does not ask for optimisation when there is nothing to reorder', async () => {
    fetchMock.mockResolvedValueOnce(routesApiOk());

    await service.computeRoute(
      request({ intermediates: [{ lat: 12.748, lng: 78.34 }] }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.optimizeWaypointOrder).toBe(false);
  });

  it('discards an order that is not a complete permutation of the stops', async () => {
    // A partial list would silently drop a customer from the run.
    fetchMock.mockResolvedValueOnce(
      routesApiOk({ optimizedIntermediateWaypointIndex: [1, 1] }),
    );

    const result = await service.computeRoute(request());

    expect(result.status).toBe('OK');
    expect(result.optimizedOrder).toEqual([]);
  });

  it('falls back to the legacy Directions API when Routes API is unavailable', async () => {
    fetchMock.mockResolvedValueOnce(upstreamError());
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'OK',
        routes: [
          {
            overview_polyline: { points: POLYLINE },
            waypoint_order: [1, 0],
            legs: [
              {
                distance: { value: 900 },
                duration: { value: 200 },
                duration_in_traffic: { value: 150 },
                steps: [{ polyline: { points: POLYLINE } }],
              },
              {
                distance: { value: 1643 },
                duration: { value: 282 },
                steps: [
                  { polyline: { points: POLYLINE } },
                  { polyline: { points: POLYLINE } },
                ],
              },
            ],
          },
        ],
      }),
    });

    const result = await service.computeRoute(request());

    expect(result.provider).toBe('google-directions');
    expect(result.distanceMeters).toBe(2543);
    // Traffic-aware time wins over the free-flow one where present.
    expect(result.durationSeconds).toBe(432);
    expect(result.optimizedOrder).toEqual([1, 0]);
    // Steps are joined with a separator outside the polyline alphabet.
    expect(result.legs[1].polyline).toBe(`${POLYLINE};${POLYLINE}`);

    const legacyUrl = fetchMock.mock.calls[1][0] as string;
    expect(legacyUrl).toContain('waypoints=optimize%3Atrue');
    expect(legacyUrl).toContain('departure_time=now');
  });

  it('reports unavailable rather than inventing a route when Google fails', async () => {
    fetchMock.mockResolvedValue(upstreamError(500));

    const result = await service.computeRoute(request());

    expect(result.status).toBe('UNAVAILABLE');
    expect(result.polyline).toBe('');
    expect(result.legs).toEqual([]);
    expect(result.distanceMeters).toBe(0);
  });

  it('keeps a definitive no-route answer without a second billed request', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ routes: [] }),
    });

    const result = await service.computeRoute(request());

    expect(result.status).toBe('ZERO_RESULTS');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves an identical run from cache instead of re-billing Google', async () => {
    fetchMock.mockResolvedValueOnce(routesApiOk());

    const first = await service.computeRoute(request());
    const second = await service.computeRoute(request());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('does not cache a failed lookup', async () => {
    fetchMock.mockResolvedValue(upstreamError(500));

    await service.computeRoute(request());
    await service.computeRoute(request());

    // Two attempts per call: Routes API, then the legacy fallback.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('refuses to route when no maps key is configured', async () => {
    const maps = { getApiKey: jest.fn().mockResolvedValue('') };
    service = new DirectionsService(maps as unknown as MapTilesService);

    const result = await service.computeRoute(request());

    expect(result.status).toBe('UNAVAILABLE');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
