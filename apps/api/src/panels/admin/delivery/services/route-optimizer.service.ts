// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : route-optimizer.service.ts
// Description : Shortest-path routing for a delivery partner's run.
//
//               Dijkstra answers "cheapest way from A to B over a graph". A run
//               has to visit every stop, which is a travelling-salesman problem,
//               so the two are combined: Dijkstra supplies the travel metric
//               between stops over a k-nearest-neighbour graph, and a
//               nearest-neighbour + 2-opt tour uses that metric to decide the
//               visiting order.
//
//               Routing over a kNN graph rather than straight lines means a leg
//               between two stops is costed along real intermediate stops,
//               which tracks road travel better than a crow-flies hop.
// ============================================================================

import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';

export interface GeoNode {
  id: string;
  lat: number;
  lng: number;
  label?: string;
}

export interface GraphEdge {
  to: string;
  weight: number;
}

export type Graph = Map<string, GraphEdge[]>;

export interface DijkstraResult {
  /** Cost of the cheapest known route from the source to each node. */
  dist: Map<string, number>;
  /** Previous hop on that route, for reconstructing the path. */
  prev: Map<string, string | null>;
}

export interface RouteLeg {
  from: string;
  to: string;
  distance_km: number;
  /** Node ids Dijkstra actually routes through, inclusive of both ends. */
  via: string[];
}

export interface OptimisedRoute {
  order: string[];
  legs: RouteLeg[];
  total_km: number;
}

/** Binary min-heap — keeps Dijkstra at O((V + E) log V) instead of O(V²). */
class MinHeap<T> {
  private heap: Array<{ item: T; priority: number }> = [];

  get size(): number {
    return this.heap.length;
  }

  push(item: T, priority: number): void {
    this.heap.push({ item, priority });
    let i = this.heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent].priority <= this.heap[i].priority) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < this.heap.length && this.heap[l].priority < this.heap[smallest].priority) smallest = l;
        if (r < this.heap.length && this.heap[r].priority < this.heap[smallest].priority) smallest = r;
        if (smallest === i) break;
        [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
        i = smallest;
      }
    }
    return top.item;
  }
}

@Injectable()
export class RouteOptimizerService {
  /** Neighbours each stop is wired to when building the graph. */
  private static readonly DEFAULT_K = 4;
  /** Ceiling on 2-opt sweeps so a large run cannot spin. */
  private static readonly MAX_TWO_OPT_PASSES = 40;

  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  // ── Geometry ──────────────────────────────────────────────────────────────

  /** Great-circle distance in kilometres. */
  haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  // ── Graph ─────────────────────────────────────────────────────────────────

  /**
   * Builds an undirected k-nearest-neighbour graph and then repairs it until
   * every node is reachable from the first one — Dijkstra can only cost a leg
   * it can actually reach.
   */
  buildGraph(nodes: GeoNode[], k = RouteOptimizerService.DEFAULT_K): Graph {
    const graph: Graph = new Map(nodes.map((n) => [n.id, [] as GraphEdge[]]));
    if (nodes.length < 2) return graph;

    const link = (a: GeoNode, b: GeoNode) => {
      if (a.id === b.id) return;
      const weight = this.haversineKm(a, b);
      const outA = graph.get(a.id)!;
      const outB = graph.get(b.id)!;
      if (!outA.some((e) => e.to === b.id)) outA.push({ to: b.id, weight });
      if (!outB.some((e) => e.to === a.id)) outB.push({ to: a.id, weight });
    };

    for (const node of nodes) {
      const nearest = nodes
        .filter((other) => other.id !== node.id)
        .map((other) => ({ other, d: this.haversineKm(node, other) }))
        .sort((x, y) => x.d - y.d)
        .slice(0, Math.max(1, k));
      for (const { other } of nearest) link(node, other);
    }

    // Connectivity repair: bridge any island to its closest reached node.
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (;;) {
      const reached = this.dijkstra(graph, nodes[0].id).dist;
      const stranded = nodes.filter((n) => !Number.isFinite(reached.get(n.id) ?? Infinity));
      if (stranded.length === 0) break;

      const connected = nodes.filter((n) => Number.isFinite(reached.get(n.id) ?? Infinity));
      let best: { a: GeoNode; b: GeoNode; d: number } | null = null;
      for (const s of stranded) {
        for (const c of connected) {
          const d = this.haversineKm(s, c);
          if (!best || d < best.d) best = { a: s, b: c, d };
        }
      }
      if (!best) break;
      link(byId.get(best.a.id)!, byId.get(best.b.id)!);
    }

    return graph;
  }

  // ── Dijkstra ──────────────────────────────────────────────────────────────

  /**
   * Single-source shortest paths. Nodes never reached keep a distance of
   * Infinity and a null predecessor.
   */
  dijkstra(graph: Graph, sourceId: string): DijkstraResult {
    const dist = new Map<string, number>();
    const prev = new Map<string, string | null>();
    const settled = new Set<string>();

    for (const id of graph.keys()) {
      dist.set(id, Infinity);
      prev.set(id, null);
    }
    if (!graph.has(sourceId)) return { dist, prev };
    dist.set(sourceId, 0);

    const queue = new MinHeap<string>();
    queue.push(sourceId, 0);

    while (queue.size > 0) {
      const current = queue.pop()!;
      if (settled.has(current)) continue;   // stale heap entry
      settled.add(current);

      for (const edge of graph.get(current) ?? []) {
        if (settled.has(edge.to)) continue;
        const candidate = (dist.get(current) ?? Infinity) + edge.weight;
        if (candidate < (dist.get(edge.to) ?? Infinity)) {
          dist.set(edge.to, candidate);
          prev.set(edge.to, current);
          queue.push(edge.to, candidate);
        }
      }
    }

    return { dist, prev };
  }

  /** Walks the predecessor chain back from `targetId`; empty if unreachable. */
  shortestPath(result: DijkstraResult, sourceId: string, targetId: string): string[] {
    if (!Number.isFinite(result.dist.get(targetId) ?? Infinity)) return [];
    const path: string[] = [];
    let cursor: string | null = targetId;
    while (cursor) {
      path.unshift(cursor);
      if (cursor === sourceId) break;
      cursor = result.prev.get(cursor) ?? null;
    }
    return path[0] === sourceId ? path : [];
  }

  // ── Tour construction ─────────────────────────────────────────────────────

  /**
   * Orders every stop into a route that starts at `startId`, using Dijkstra
   * distances as the cost between stops: nearest-neighbour for a first pass,
   * then 2-opt to undo the crossings greedy ordering leaves behind.
   */
  optimiseSequence(nodes: GeoNode[], startId: string, k = RouteOptimizerService.DEFAULT_K): OptimisedRoute {
    if (nodes.length === 0) return { order: [], legs: [], total_km: 0 };
    if (!nodes.some((n) => n.id === startId)) {
      throw new BadRequestException('Start node is not part of the route');
    }

    const graph = this.buildGraph(nodes, k);
    const paths = new Map<string, DijkstraResult>();
    for (const node of nodes) paths.set(node.id, this.dijkstra(graph, node.id));

    const cost = (from: string, to: string): number =>
      paths.get(from)?.dist.get(to) ?? Infinity;

    // Nearest neighbour seed
    const unvisited = new Set(nodes.map((n) => n.id));
    unvisited.delete(startId);
    const order: string[] = [startId];

    while (unvisited.size > 0) {
      const last = order[order.length - 1];
      let best: string | null = null;
      let bestCost = Infinity;
      for (const candidate of unvisited) {
        const c = cost(last, candidate);
        if (c < bestCost) {
          bestCost = c;
          best = candidate;
        }
      }
      if (best === null) best = unvisited.values().next().value as string;
      order.push(best);
      unvisited.delete(best);
    }

    // 2-opt: reverse any segment that shortens the route. The depot stays put.
    const tourLength = (seq: string[]) =>
      seq.slice(0, -1).reduce((sum, id, i) => sum + cost(id, seq[i + 1]), 0);

    let improved = true;
    let passes = 0;
    let bestOrder = order;
    let bestLength = tourLength(bestOrder);

    while (improved && passes < RouteOptimizerService.MAX_TWO_OPT_PASSES) {
      improved = false;
      passes++;
      for (let i = 1; i < bestOrder.length - 1; i++) {
        for (let j = i + 1; j < bestOrder.length; j++) {
          const candidate = [
            ...bestOrder.slice(0, i),
            ...bestOrder.slice(i, j + 1).reverse(),
            ...bestOrder.slice(j + 1),
          ];
          const length = tourLength(candidate);
          if (length < bestLength - 1e-9) {
            bestOrder = candidate;
            bestLength = length;
            improved = true;
          }
        }
      }
    }

    const legs: RouteLeg[] = bestOrder.slice(0, -1).map((from, i) => {
      const to = bestOrder[i + 1];
      const result = paths.get(from)!;
      return {
        from,
        to,
        distance_km: Number((result.dist.get(to) ?? 0).toFixed(3)),
        via: this.shortestPath(result, from, to),
      };
    });

    return {
      order: bestOrder,
      legs,
      total_km: Number(bestLength.toFixed(3)),
    };
  }

  // ── Run integration ───────────────────────────────────────────────────────

  /**
   * Re-sequences a delivery run's stops.
   *
   * Coordinates come from customer_addresses — delivery_run_addresses carries
   * lat/lng columns but they are not populated. Stops without coordinates keep
   * their relative order and are appended after the routed ones.
   */
  async optimiseRun(runId: string, options: { persist?: boolean } = {}) {
    const persist = options.persist !== false;
    try {
      const runRows = await this.db.query<any>(
        `SELECT dr.run_id, dr.id, dr.branch_id, dr.delivery_partner_id, dr.run_date,
                dr.delivery_slot, dr.status,
                COALESCE(w.latitude,  b.lat) AS depot_lat,
                COALESCE(w.longitude, b.lng) AS depot_lng,
                COALESCE(w.name, b.branch_name) AS depot_name
           FROM delivery_runs dr
           LEFT JOIN branches b ON b.branch_id = dr.branch_id
           LEFT JOIN warehouses w
             ON w.branch_id = dr.branch_id AND w.is_active = true AND w.deleted_at IS NULL
          WHERE dr.run_id = $1 OR dr.id::varchar = $1
          LIMIT 1`,
        [String(runId)],
      );
      const run = runRows?.[0];
      if (!run) throw new BadRequestException(`Delivery run ${runId} not found`);
      if (['completed', 'cancelled'].includes(run.status)) {
        throw new BadRequestException(`Run ${run.run_id} is ${run.status} and cannot be re-sequenced`);
      }

      const stops = await this.db.query<any>(
        `SELECT dra.id, dra.address_id, dra.customer_id, dra.sequence_no,
                dra.delivery_status,
                COALESCE(dra.latitude,  ca.latitude)  AS lat,
                COALESCE(dra.longitude, ca.longitude) AS lng,
                COALESCE(ca.area, ca.building_name, dra.address_line) AS label
           FROM delivery_run_addresses dra
           LEFT JOIN customer_addresses ca ON ca.address_id = dra.address_id
          WHERE dra.run_id = $1 AND dra.deleted_at IS NULL
          ORDER BY dra.sequence_no ASC, dra.id ASC`,
        [run.run_id],
      );

      if (!stops?.length) {
        return {
          status: true,
          data: { run_id: run.run_id, stops: 0, message: 'Run has no stops to sequence' },
          message: 'Nothing to optimise',
        };
      }

      const routable = stops.filter((s: any) => s.lat != null && s.lng != null);
      const unroutable = stops.filter((s: any) => s.lat == null || s.lng == null);

      const depotLat = Number(run.depot_lat);
      const depotLng = Number(run.depot_lng);
      const hasDepot = Number.isFinite(depotLat) && Number.isFinite(depotLng);

      if (routable.length < 2 || !hasDepot) {
        return {
          status: true,
          data: {
            run_id: run.run_id,
            stops: stops.length,
            routable: routable.length,
            skipped: unroutable.length,
            reason: !hasDepot
              ? 'Branch has no coordinates to start the route from'
              : 'Fewer than two stops carry coordinates',
          },
          message: 'Not enough geocoded stops to optimise',
        };
      }

      const DEPOT = '__depot__';
      const nodes: GeoNode[] = [
        { id: DEPOT, lat: depotLat, lng: depotLng, label: run.depot_name ?? 'Depot' },
        ...routable.map((s: any) => ({
          id: String(s.id),
          lat: Number(s.lat),
          lng: Number(s.lng),
          label: s.label ?? s.address_id,
        })),
      ];

      // Distance of the order the run is in right now, for comparison.
      const currentOrder = [DEPOT, ...routable.map((s: any) => String(s.id))];
      const graph = this.buildGraph(nodes);
      const currentKm = currentOrder.slice(0, -1).reduce((sum, id, i) => {
        const d = this.dijkstra(graph, id).dist.get(currentOrder[i + 1]) ?? 0;
        return sum + (Number.isFinite(d) ? d : 0);
      }, 0);

      const route = this.optimiseSequence(nodes, DEPOT);
      const byId = new Map(routable.map((s: any) => [String(s.id), s]));
      const sequenced = route.order.filter((id) => id !== DEPOT);

      if (persist) {
        await this.db.transaction(async (client) => {
          let seq = 1;
          for (const nodeId of sequenced) {
            await client.query(
              `UPDATE delivery_run_addresses
                  SET sequence_no = $1, sequence_number = $1, updated_at = NOW()
                WHERE id = $2`,
              [seq++, Number(nodeId)],
            );
          }
          // Stops without coordinates trail the routed ones.
          for (const stop of unroutable) {
            await client.query(
              `UPDATE delivery_run_addresses
                  SET sequence_no = $1, sequence_number = $1, updated_at = NOW()
                WHERE id = $2`,
              [seq++, stop.id],
            );
          }
          await client.query(
            `UPDATE delivery_runs
                SET total_distance_km = $1, updated_at = NOW()
              WHERE run_id = $2`,
            [route.total_km, run.run_id],
          );
        });
      }

      return {
        status: true,
        data: {
          run_id: run.run_id,
          depot: { name: run.depot_name, lat: depotLat, lng: depotLng },
          stops: stops.length,
          routable: routable.length,
          skipped: unroutable.length,
          previous_distance_km: Number(currentKm.toFixed(3)),
          optimised_distance_km: route.total_km,
          saved_km: Number((currentKm - route.total_km).toFixed(3)),
          persisted: persist,
          sequence: sequenced.map((id, i) => {
            const stop = byId.get(id);
            return {
              sequence_no: i + 1,
              id: stop?.id,
              address_id: stop?.address_id,
              customer_id: stop?.customer_id,
              label: stop?.label,
              previous_sequence_no: stop?.sequence_no,
            };
          }),
          legs: route.legs.map((leg) => ({
            from: leg.from === DEPOT ? 'Depot' : byId.get(leg.from)?.label ?? leg.from,
            to: leg.to === DEPOT ? 'Depot' : byId.get(leg.to)?.label ?? leg.to,
            distance_km: leg.distance_km,
            hops: leg.via.length - 1,
          })),
        },
        message: persist ? 'Run sequence optimised' : 'Optimised route preview',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('optimiseRun error', { error, runId });
      throw new InternalServerErrorException('Failed to optimise delivery run');
    }
  }
}
