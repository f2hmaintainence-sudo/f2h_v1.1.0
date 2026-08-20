import { BadRequestException, Injectable } from '@nestjs/common';

export type BranchCoverageShape = 'circle' | 'square' | 'rectangle' | 'hexagon';

export interface BranchCoverageArea {
  branch_id?: string | null;
  branch_name?: string | null;
  lat: number | string | null;
  lng: number | string | null;
  delivery_radius_km: number | string | null;
  buffer_zone?: number | string | null;
  allow_buffer_order?: boolean | string | null;
  is_active?: boolean | string | null;
  hex_shape?: string | null;
}

export interface BranchCoverageConflict {
  branch_id: string;
  branch_name: string;
}

interface Point {
  x: number;
  y: number;
}

export interface BranchCoverageTransaction {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<[T[]]>;
}

interface NormalizedCoverageArea {
  center: Point;
  radiusKm: number;
  shape: BranchCoverageShape;
}

const EARTH_RADIUS_KM = 6371;
const DEGREES_TO_RADIANS = Math.PI / 180;
const GEOMETRY_EPSILON = 1e-9;
const COVERAGE_LOCK_KEY = 'branch-coverage';
const RECTANGLE_CORNER_BEARING_RADIANS = Math.atan2(2, 1);

function parseBoolean(
  value: boolean | string | null | undefined,
  fallback: boolean,
): boolean {
  if (value === null || value === undefined) return fallback;
  return value === true || value === 'true';
}

function normalizeShape(value: string | null | undefined): BranchCoverageShape {
  if (
    value === 'circle' ||
    value === 'square' ||
    value === 'rectangle' ||
    value === 'hexagon'
  ) {
    return value;
  }
  return 'hexagon';
}

function effectiveRadiusKm(area: BranchCoverageArea): number | null {
  const deliveryRadiusKm = Number(area.delivery_radius_km);
  if (!Number.isFinite(deliveryRadiusKm) || deliveryRadiusKm <= 0) return null;

  const bufferZoneKm = Number(area.buffer_zone ?? 0);
  const allowedBufferKm =
    parseBoolean(area.allow_buffer_order, false) &&
    Number.isFinite(bufferZoneKm) &&
    bufferZoneKm > 0
      ? bufferZoneKm
      : 0;

  return deliveryRadiusKm + allowedBufferKm;
}

function normalizeLongitudeDelta(delta: number): number {
  return ((delta + 540) % 360) - 180;
}

function centerOffsetKm(
  origin: BranchCoverageArea,
  target: BranchCoverageArea,
): Point | null {
  if (
    origin.lat === null ||
    origin.lat === undefined ||
    origin.lng === null ||
    origin.lng === undefined ||
    target.lat === null ||
    target.lat === undefined ||
    target.lng === null ||
    target.lng === undefined
  ) {
    return null;
  }
  const originLat = Number(origin.lat);
  const originLng = Number(origin.lng);
  const targetLat = Number(target.lat);
  const targetLng = Number(target.lng);
  if (![originLat, originLng, targetLat, targetLng].every(Number.isFinite))
    return null;

  const meanLatitudeRadians =
    ((originLat + targetLat) / 2) * DEGREES_TO_RADIANS;
  const latitudeDeltaRadians = (targetLat - originLat) * DEGREES_TO_RADIANS;
  const longitudeDeltaRadians =
    normalizeLongitudeDelta(targetLng - originLng) * DEGREES_TO_RADIANS;

  return {
    x: EARTH_RADIUS_KM * longitudeDeltaRadians * Math.cos(meanLatitudeRadians),
    y: EARTH_RADIUS_KM * latitudeDeltaRadians,
  };
}

function normalizeArea(
  area: BranchCoverageArea,
  center: Point,
): NormalizedCoverageArea | null {
  const radiusKm = effectiveRadiusKm(area);
  if (radiusKm === null) return null;

  return {
    center,
    radiusKm,
    shape: normalizeShape(area.hex_shape),
  };
}

function polygonBearings(
  shape: Exclude<BranchCoverageShape, 'circle'>,
): number[] {
  if (shape === 'hexagon') {
    return [0, 60, 120, 180, 240, 300].map(
      (degrees) => degrees * DEGREES_TO_RADIANS,
    );
  }
  if (shape === 'square') {
    return [45, 135, 225, 315].map((degrees) => degrees * DEGREES_TO_RADIANS);
  }
  return [
    RECTANGLE_CORNER_BEARING_RADIANS,
    Math.PI - RECTANGLE_CORNER_BEARING_RADIANS,
    Math.PI + RECTANGLE_CORNER_BEARING_RADIANS,
    2 * Math.PI - RECTANGLE_CORNER_BEARING_RADIANS,
  ];
}

function buildPolygon(area: NormalizedCoverageArea): Point[] {
  if (area.shape === 'circle') return [];

  return polygonBearings(area.shape).map((bearing) => ({
    x: area.center.x + area.radiusKm * Math.sin(bearing),
    y: area.center.y + area.radiusKm * Math.cos(bearing),
  }));
}

function squaredDistance(first: Point, second: Point): number {
  const x = first.x - second.x;
  const y = first.y - second.y;
  return x * x + y * y;
}

function squaredDistanceToSegment(
  point: Point,
  start: Point,
  end: Point,
): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (segmentLengthSquared <= GEOMETRY_EPSILON)
    return squaredDistance(point, start);

  const projection =
    ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) /
    segmentLengthSquared;
  const clampedProjection = Math.max(0, Math.min(1, projection));
  return squaredDistance(point, {
    x: start.x + clampedProjection * segmentX,
    y: start.y + clampedProjection * segmentY,
  });
}

function isPointInsidePolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current++
  ) {
    const start = polygon[previous];
    const end = polygon[current];
    if (squaredDistanceToSegment(point, start, end) <= GEOMETRY_EPSILON)
      return true;

    const crossesRay = end.y > point.y !== start.y > point.y;
    if (!crossesRay) continue;

    const intersectionX =
      ((start.x - end.x) * (point.y - end.y)) / (start.y - end.y) + end.x;
    if (point.x < intersectionX) inside = !inside;
  }
  return inside;
}

function circleAndPolygonOverlap(
  circle: NormalizedCoverageArea,
  polygon: Point[],
): boolean {
  if (isPointInsidePolygon(circle.center, polygon)) return true;

  const radiusSquared = circle.radiusKm * circle.radiusKm;
  for (let index = 0; index < polygon.length; index += 1) {
    const nextIndex = (index + 1) % polygon.length;
    if (
      squaredDistanceToSegment(
        circle.center,
        polygon[index],
        polygon[nextIndex],
      ) <=
      radiusSquared + GEOMETRY_EPSILON
    ) {
      return true;
    }
  }
  return false;
}

function projectedRange(
  polygon: Point[],
  axis: Point,
): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const point of polygon) {
    const projection = point.x * axis.x + point.y * axis.y;
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  return { min, max };
}

function polygonsOverlap(first: Point[], second: Point[]): boolean {
  for (const polygon of [first, second]) {
    for (let index = 0; index < polygon.length; index += 1) {
      const nextIndex = (index + 1) % polygon.length;
      const edge = {
        x: polygon[nextIndex].x - polygon[index].x,
        y: polygon[nextIndex].y - polygon[index].y,
      };
      const axis = { x: -edge.y, y: edge.x };
      const firstRange = projectedRange(first, axis);
      const secondRange = projectedRange(second, axis);
      if (
        firstRange.max < secondRange.min - GEOMETRY_EPSILON ||
        secondRange.max < firstRange.min - GEOMETRY_EPSILON
      ) {
        return false;
      }
    }
  }
  return true;
}

export function coverageAreasOverlap(
  first: BranchCoverageArea,
  second: BranchCoverageArea,
): boolean {
  const secondCenter = centerOffsetKm(first, second);
  if (secondCenter === null) return false;

  const firstArea = normalizeArea(first, { x: 0, y: 0 });
  const secondArea = normalizeArea(second, secondCenter);
  if (firstArea === null || secondArea === null) return false;

  const centerDistanceSquared = squaredDistance(
    firstArea.center,
    secondArea.center,
  );
  const broadPhaseRadius = firstArea.radiusKm + secondArea.radiusKm;
  if (
    centerDistanceSquared >
    broadPhaseRadius * broadPhaseRadius + GEOMETRY_EPSILON
  ) {
    return false;
  }

  if (firstArea.shape === 'circle' && secondArea.shape === 'circle') {
    return true;
  }

  const firstPolygon = buildPolygon(firstArea);
  const secondPolygon = buildPolygon(secondArea);
  if (firstArea.shape === 'circle') {
    return circleAndPolygonOverlap(firstArea, secondPolygon);
  }
  if (secondArea.shape === 'circle') {
    return circleAndPolygonOverlap(secondArea, firstPolygon);
  }
  return polygonsOverlap(firstPolygon, secondPolygon);
}

@Injectable()
export class BranchCoverageOverlapService {
  async lockCoverageChanges(
    transaction: BranchCoverageTransaction,
  ): Promise<void> {
    await transaction.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      COVERAGE_LOCK_KEY,
    ]);
  }

  async findConflict(
    transaction: BranchCoverageTransaction,
    candidate: BranchCoverageArea,
    excludeBranchId: string | null = null,
  ): Promise<BranchCoverageConflict | null> {
    if (!parseBoolean(candidate.is_active, true)) return null;

    const hasLatitude = candidate.lat !== null && candidate.lat !== undefined;
    const hasLongitude = candidate.lng !== null && candidate.lng !== undefined;
    if (!hasLatitude && !hasLongitude) return null;
    if (!hasLatitude || !hasLongitude) {
      throw new BadRequestException({
        status: false,
        message: 'Both branch latitude and longitude are required',
      });
    }

    const latitude = Number(candidate.lat);
    const longitude = Number(candidate.lng);
    const radiusKm = Number(candidate.delivery_radius_km);
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180 ||
      !Number.isFinite(radiusKm) ||
      radiusKm < 0.5 ||
      radiusKm > 50
    ) {
      throw new BadRequestException({
        status: false,
        message: 'Invalid active branch coverage coordinates or radius',
      });
    }

    await this.lockCoverageChanges(transaction);
    const [branches] = await transaction.query<
      BranchCoverageArea & {
        branch_id: string;
        branch_name: string;
      }
    >(
      `SELECT branch_id, branch_name,
              lat::float8 AS lat, lng::float8 AS lng,
              delivery_radius_km::float8 AS delivery_radius_km,
              COALESCE(buffer_zone, 0)::float8 AS buffer_zone,
              COALESCE(allow_buffer_order, false) AS allow_buffer_order,
              COALESCE(hex_shape, 'hexagon') AS hex_shape,
              is_active
         FROM branches
        WHERE deleted_at IS NULL
          AND is_active = true
          AND lat IS NOT NULL
          AND lng IS NOT NULL
          AND delivery_radius_km > 0
          AND ($1::text IS NULL OR branch_id <> $1)
        ORDER BY branch_name ASC, branch_id ASC`,
      [excludeBranchId],
    );

    const conflictingBranch = branches.find((branch) =>
      coverageAreasOverlap(candidate, branch),
    );
    if (!conflictingBranch) return null;

    return {
      branch_id: conflictingBranch.branch_id,
      branch_name: conflictingBranch.branch_name,
    };
  }
}
