export type ShapeType = 'hexagon' | 'circle' | 'square' | 'rectangle';

export interface BranchArea {
  branch_id?: string;
  branch_name: string;
  lat?: number | null;
  lng?: number | null;
  delivery_radius_km?: number | null;
  buffer_zone?: number | null;
  allow_buffer_order?: boolean | string | null;
  is_active?: boolean | string | null;
  hex_shape?: ShapeType;
}

interface Point {
  x: number;
  y: number;
}

interface NormalizedArea {
  center: Point;
  radiusKm: number;
  shape: ShapeType;
}

const EARTH_RADIUS_KM = 6371;
const DEGREES_TO_RADIANS = Math.PI / 180;
const GEOMETRY_EPSILON = 1e-9;
const RECTANGLE_CORNER_BEARING_RADIANS = Math.atan2(2, 1);

function effectiveRadiusKm(area: BranchArea): number | null {
  const deliveryRadiusKm = Number(area.delivery_radius_km);
  if (!Number.isFinite(deliveryRadiusKm) || deliveryRadiusKm <= 0) return null;

  const bufferZoneKm = Number(area.buffer_zone ?? 0);
  const allowedBufferKm =
    (area.allow_buffer_order === true || String(area.allow_buffer_order) === 'true') &&
    Number.isFinite(bufferZoneKm) &&
    bufferZoneKm > 0
      ? bufferZoneKm
      : 0;

  return deliveryRadiusKm + allowedBufferKm;
}

function normalizeLongitudeDelta(delta: number): number {
  return ((delta + 540) % 360) - 180;
}

function centerOffsetKm(origin: BranchArea, target: BranchArea): Point | null {
  if (
    origin.lat === null || origin.lat === undefined ||
    origin.lng === null || origin.lng === undefined ||
    target.lat === null || target.lat === undefined ||
    target.lng === null || target.lng === undefined
  ) {
    return null;
  }
  const originLat = Number(origin.lat);
  const originLng = Number(origin.lng);
  const targetLat = Number(target.lat);
  const targetLng = Number(target.lng);
  if (![originLat, originLng, targetLat, targetLng].every(Number.isFinite)) return null;

  const meanLatitudeRadians = ((originLat + targetLat) / 2) * DEGREES_TO_RADIANS;
  const latitudeDeltaRadians = (targetLat - originLat) * DEGREES_TO_RADIANS;
  const longitudeDeltaRadians = normalizeLongitudeDelta(targetLng - originLng) * DEGREES_TO_RADIANS;

  return {
    x: EARTH_RADIUS_KM * longitudeDeltaRadians * Math.cos(meanLatitudeRadians),
    y: EARTH_RADIUS_KM * latitudeDeltaRadians,
  };
}

function polygonBearings(shape: Exclude<ShapeType, 'circle'>): number[] {
  if (shape === 'hexagon') {
    return [0, 60, 120, 180, 240, 300].map((d) => d * DEGREES_TO_RADIANS);
  }
  if (shape === 'square') {
    return [45, 135, 225, 315].map((d) => d * DEGREES_TO_RADIANS);
  }
  return [
    RECTANGLE_CORNER_BEARING_RADIANS,
    Math.PI - RECTANGLE_CORNER_BEARING_RADIANS,
    Math.PI + RECTANGLE_CORNER_BEARING_RADIANS,
    2 * Math.PI - RECTANGLE_CORNER_BEARING_RADIANS,
  ];
}

function buildPolygon(area: NormalizedArea): Point[] {
  if (area.shape === 'circle') return [];
  return polygonBearings(area.shape).map((bearing) => ({
    x: area.center.x + area.radiusKm * Math.sin(bearing),
    y: area.center.y + area.radiusKm * Math.cos(bearing),
  }));
}

function squaredDistance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
}

function squaredDistanceToSegment(point: Point, start: Point, end: Point): number {
  const segX = end.x - start.x;
  const segY = end.y - start.y;
  const segLenSq = segX * segX + segY * segY;
  if (segLenSq <= GEOMETRY_EPSILON) return squaredDistance(point, start);

  const projection = ((point.x - start.x) * segX + (point.y - start.y) * segY) / segLenSq;
  const clamped = Math.max(0, Math.min(1, projection));
  return squaredDistance(point, {
    x: start.x + clamped * segX,
    y: start.y + clamped * segY,
  });
}

function isPointInsidePolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let c = 0, p = polygon.length - 1; c < polygon.length; p = c++) {
    const start = polygon[p];
    const end = polygon[c];
    if (squaredDistanceToSegment(point, start, end) <= GEOMETRY_EPSILON) return true;
    const crossesRay = end.y > point.y !== start.y > point.y;
    if (!crossesRay) continue;
    const intersectionX = ((start.x - end.x) * (point.y - end.y)) / (start.y - end.y) + end.x;
    if (point.x < intersectionX) inside = !inside;
  }
  return inside;
}

function circleAndPolygonOverlap(circle: NormalizedArea, polygon: Point[]): boolean {
  if (isPointInsidePolygon(circle.center, polygon)) return true;
  const radiusSq = circle.radiusKm * circle.radiusKm;
  for (let i = 0; i < polygon.length; i++) {
    const nextI = (i + 1) % polygon.length;
    if (squaredDistanceToSegment(circle.center, polygon[i], polygon[nextI]) <= radiusSq + GEOMETRY_EPSILON) {
      return true;
    }
  }
  return false;
}

function polygonsOverlap(poly1: Point[], poly2: Point[]): boolean {
  for (const polygon of [poly1, poly2]) {
    for (let i = 0; i < polygon.length; i++) {
      const nextI = (i + 1) % polygon.length;
      const edge = { x: polygon[nextI].x - polygon[i].x, y: polygon[nextI].y - polygon[i].y };
      const length = Math.hypot(edge.x, edge.y);
      if (length <= GEOMETRY_EPSILON) continue;
      const axis = { x: -edge.y / length, y: edge.x / length };

      let min1 = Infinity, max1 = -Infinity;
      for (const p of poly1) {
        const proj = p.x * axis.x + p.y * axis.y;
        min1 = Math.min(min1, proj);
        max1 = Math.max(max1, proj);
      }

      let min2 = Infinity, max2 = -Infinity;
      for (const p of poly2) {
        const proj = p.x * axis.x + p.y * axis.y;
        min2 = Math.min(min2, proj);
        max2 = Math.max(max2, proj);
      }

      if (max1 < min2 - GEOMETRY_EPSILON || max2 < min1 - GEOMETRY_EPSILON) {
        return false;
      }
    }
  }
  return true;
}

export function checkAreasOverlap(area1: BranchArea, area2: BranchArea): boolean {
  const r1 = effectiveRadiusKm(area1);
  const r2 = effectiveRadiusKm(area2);
  if (r1 === null || r2 === null) return false;

  const offset = centerOffsetKm(area1, area2);
  if (!offset) return false;

  const shape1 = area1.hex_shape || 'hexagon';
  const shape2 = area2.hex_shape || 'hexagon';

  const norm1: NormalizedArea = { center: { x: 0, y: 0 }, radiusKm: r1, shape: shape1 };
  const norm2: NormalizedArea = { center: offset, radiusKm: r2, shape: shape2 };

  if (shape1 === 'circle' && shape2 === 'circle') {
    const distSq = offset.x * offset.x + offset.y * offset.y;
    const combinedR = r1 + r2;
    return distSq <= combinedR * combinedR + GEOMETRY_EPSILON;
  }

  if (shape1 === 'circle') {
    return circleAndPolygonOverlap(norm1, buildPolygon(norm2));
  }

  if (shape2 === 'circle') {
    return circleAndPolygonOverlap(norm2, buildPolygon(norm1));
  }

  return polygonsOverlap(buildPolygon(norm1), buildPolygon(norm2));
}

export function findOverlappingBranch(
  current: BranchArea,
  existingList: BranchArea[],
  excludeBranchId?: string,
): BranchArea | null {
  if (current.lat === null || current.lat === undefined || current.lng === null || current.lng === undefined) {
    return null;
  }
  for (const other of existingList) {
    if (excludeBranchId && other.branch_id === excludeBranchId) continue;
    if (current.branch_id && other.branch_id === current.branch_id) continue;
    if (other.lat === null || other.lat === undefined || other.lng === null || other.lng === undefined) continue;

    if (checkAreasOverlap(current, other)) {
      return other;
    }
  }
  return null;
}
