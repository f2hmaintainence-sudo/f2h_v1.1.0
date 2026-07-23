// ═══════════════════════════════════════════════════════════════
// route-optimizer.util.ts
// Pure TypeScript — zero external dependencies
// Provides: haversine distance, GPS grid clustering,
//           nearest-neighbor TSP, delivery boy strip distribution
// ═══════════════════════════════════════════════════════════════

export interface CustomerStop {
  id: string;
  address_lat: number;
  address_lng: number;
  apartment_name?: string | null;
  area?: string | null;
  full_name?: string;
}

// ───────────────────────────────────────────────
// 1. Haversine Distance (returns metres)
// ───────────────────────────────────────────────
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000; // Earth radius in metres
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

// ───────────────────────────────────────────────
// 2. GPS Grid Clustering
//    Groups customers into ~300m grid cells.
//    Each cell becomes a candidate delivery route.
// ───────────────────────────────────────────────
export interface GeoCluster {
  cellKey: string;
  cellRow: number;
  cellCol: number;
  customers: CustomerStop[];
  centroidLat: number;
  centroidLng: number;
  suggestedName: string;
}

/**
 * Clusters customers by GPS proximity using a grid-cell approach.
 * @param customers  Pool A customers (must have address_lat + address_lng)
 * @param cellSizeMeters  Grid cell size in metres (~300m default)
 * @param maxStops  Max customers per cluster before splitting
 * @param minStops  Min customers per cluster before merging
 */
export function geoCluster(
  customers: CustomerStop[],
  cellSizeMeters = 300,
  maxStops = 40,
  minStops = 5,
): GeoCluster[] {
  if (!customers.length) return [];

  // Degrees per metre (approximate at Indian latitudes ~15°N)
  const latDegPerMetre = 1 / 111_000;
  const lngDegPerMetre = 1 / 101_500; // cos(15°) × 111,000
  const cellLat = cellSizeMeters * latDegPerMetre;
  const cellLng = cellSizeMeters * lngDegPerMetre;

  // Bounding box
  const minLat = Math.min(...customers.map((c) => c.address_lat));
  const minLng = Math.min(...customers.map((c) => c.address_lng));

  // Assign each customer to a grid cell
  const cellMap = new Map<string, CustomerStop[]>();
  for (const c of customers) {
    const row = Math.floor((c.address_lat - minLat) / cellLat);
    const col = Math.floor((c.address_lng - minLng) / cellLng);
    const key = `${row}_${col}`;
    if (!cellMap.has(key)) cellMap.set(key, []);
    cellMap.get(key)!.push(c);
  }

  // Build initial clusters
  let clusters: GeoCluster[] = [];
  for (const [key, custs] of cellMap.entries()) {
    const [rowStr, colStr] = key.split('_');
    const row = Number(rowStr);
    const col = Number(colStr);
    clusters.push(buildCluster(key, row, col, custs));
  }

  // ── Merge tiny clusters (< minStops) into nearest neighbour ──
  let changed = true;
  while (changed) {
    changed = false;
    const tiny = clusters.find((c) => c.customers.length < minStops);
    if (!tiny) break;

    // Remove tiny from list
    clusters = clusters.filter((c) => c.cellKey !== tiny.cellKey);

    // Find nearest remaining cluster by centroid distance
    let nearest: GeoCluster | null = null;
    let nearestDist = Infinity;
    for (const c of clusters) {
      const d = haversineDistance(
        tiny.centroidLat,
        tiny.centroidLng,
        c.centroidLat,
        c.centroidLng,
      );
      if (d < nearestDist) {
        nearestDist = d;
        nearest = c;
      }
    }

    if (nearest) {
      // Merge tiny into nearest
      nearest.customers.push(...tiny.customers);
      recomputeCluster(nearest);
      changed = true;
    } else {
      // No neighbours — put back as-is (edge case: single cluster)
      clusters.push(tiny);
    }
  }

  // ── Split oversized clusters (> maxStops) ──
  const result: GeoCluster[] = [];
  for (const cluster of clusters) {
    if (cluster.customers.length <= maxStops) {
      result.push(cluster);
      continue;
    }
    // Split along east-west axis (longitude)
    const sorted = [...cluster.customers].sort(
      (a, b) => a.address_lng - b.address_lng,
    );
    const half = Math.ceil(sorted.length / 2);
    const west = sorted.slice(0, half);
    const east = sorted.slice(half);
    const clusterA = buildCluster(`${cluster.cellKey}_A`, cluster.cellRow, cluster.cellCol, west);
    const clusterB = buildCluster(`${cluster.cellKey}_B`, cluster.cellRow, cluster.cellCol, east);
    clusterA.suggestedName = cluster.suggestedName + ' (West)';
    clusterB.suggestedName = cluster.suggestedName + ' (East)';
    result.push(clusterA, clusterB);
  }

  return result;
}

function buildCluster(
  key: string,
  row: number,
  col: number,
  customers: CustomerStop[],
): GeoCluster {
  const cluster: GeoCluster = {
    cellKey: key,
    cellRow: row,
    cellCol: col,
    customers,
    centroidLat: 0,
    centroidLng: 0,
    suggestedName: '',
  };
  recomputeCluster(cluster);
  return cluster;
}

function recomputeCluster(cluster: GeoCluster): void {
  // Centroid
  cluster.centroidLat =
    cluster.customers.reduce((s, c) => s + c.address_lat, 0) / cluster.customers.length;
  cluster.centroidLng =
    cluster.customers.reduce((s, c) => s + c.address_lng, 0) / cluster.customers.length;

  // Suggested route name
  cluster.suggestedName = suggestRouteName(
    cluster.customers,
    cluster.cellRow,
    cluster.cellCol,
  );
}

/**
 * Decides the route name from the cluster's customers.
 * Priority:
 *   1. apartment_name if 60%+ of customers share it
 *   2. most common area/locality name
 *   3. Grid position fallback "Zone row-col"
 */
export function suggestRouteName(
  customers: CustomerStop[],
  row: number,
  col: number,
): string {
  const total = customers.length;

  // Count apartment_name frequencies
  const aptCount = new Map<string, number>();
  for (const c of customers) {
    if (c.apartment_name?.trim()) {
      const k = c.apartment_name.trim();
      aptCount.set(k, (aptCount.get(k) ?? 0) + 1);
    }
  }
  const topApt = [...aptCount.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topApt && topApt[1] / total >= 0.6) {
    return topApt[0];
  }

  // Count area/locality frequencies
  const areaCount = new Map<string, number>();
  for (const c of customers) {
    if (c.area?.trim()) {
      const k = c.area.trim();
      areaCount.set(k, (areaCount.get(k) ?? 0) + 1);
    }
  }
  const topArea = [...areaCount.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topArea) {
    return topArea[0];
  }

  // Fallback: grid position
  return `Zone ${row}-${col}`;
}

// ───────────────────────────────────────────────
// 3. Nearest-Neighbor TSP
//    Returns ordered indices into the stops array.
//    Start: warehouse location.
// ───────────────────────────────────────────────
export function nearestNeighborTSP(
  stops: { lat: number; lng: number }[],
  startLat: number,
  startLng: number,
): number[] {
  if (!stops.length) return [];

  const n = stops.length;
  const visited = new Array<boolean>(n).fill(false);
  const order: number[] = [];
  let curLat = startLat;
  let curLng = startLng;

  for (let step = 0; step < n; step++) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const d = haversineDistance(curLat, curLng, stops[i].lat, stops[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    visited[bestIdx] = true;
    order.push(bestIdx);
    curLat = stops[bestIdx].lat;
    curLng = stops[bestIdx].lng;
  }

  return order;
}

/**
 * Computes total route distance for an ordered list of stops (metres).
 */
export function totalRouteDistance(
  orderedStops: { lat: number; lng: number }[],
  startLat: number,
  startLng: number,
): number {
  if (!orderedStops.length) return 0;
  let dist = haversineDistance(startLat, startLng, orderedStops[0].lat, orderedStops[0].lng);
  for (let i = 1; i < orderedStops.length; i++) {
    dist += haversineDistance(
      orderedStops[i - 1].lat,
      orderedStops[i - 1].lng,
      orderedStops[i].lat,
      orderedStops[i].lng,
    );
  }
  return dist;
}

// ───────────────────────────────────────────────
// 4. Distribute Routes Across Delivery Boys
//    Contiguous geographic strip assignment.
//    Sorts clusters west→east, divides into N strips.
// ───────────────────────────────────────────────
export function distributeRoutesAcrossBoys(
  clusters: GeoCluster[],
  boyIds: string[],
): Map<string, GeoCluster[]> {
  const result = new Map<string, GeoCluster[]>();
  if (!boyIds.length || !clusters.length) return result;

  // Sort clusters west→east by centroid longitude
  const sorted = [...clusters].sort(
    (a, b) => a.centroidLng - b.centroidLng,
  );

  const n = boyIds.length;
  const stripSize = Math.ceil(sorted.length / n);

  for (let i = 0; i < n; i++) {
    const boyId = boyIds[i];
    const strip = sorted.slice(i * stripSize, (i + 1) * stripSize);
    result.set(boyId, strip);
  }

  return result;
}
