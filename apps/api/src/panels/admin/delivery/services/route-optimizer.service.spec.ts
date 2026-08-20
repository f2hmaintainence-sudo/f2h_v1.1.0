import {
  RouteOptimizerService,
  Graph,
  GeoNode,
} from './route-optimizer.service';

/** The service only touches db/developer in optimiseRun; the core is pure. */
function optimizer(): RouteOptimizerService {
  return new RouteOptimizerService(null as any, null as any);
}

/** Builds an undirected graph from [from, to, weight] triples. */
function graphOf(edges: Array<[string, string, number]>, isolated: string[] = []): Graph {
  const g: Graph = new Map();
  const ensure = (id: string) => {
    if (!g.has(id)) g.set(id, []);
    return g.get(id)!;
  };
  for (const id of isolated) ensure(id);
  for (const [from, to, weight] of edges) {
    ensure(from).push({ to, weight });
    ensure(to).push({ to: from, weight });
  }
  return g;
}

describe('RouteOptimizerService — Dijkstra', () => {
  const svc = optimizer();

  it('prefers a cheaper multi-hop route over an expensive direct edge', () => {
    // A→D directly costs 10, but A→B→C→D costs 3.
    const g = graphOf([
      ['A', 'D', 10],
      ['A', 'B', 1],
      ['B', 'C', 1],
      ['C', 'D', 1],
    ]);

    const result = svc.dijkstra(g, 'A');

    expect(result.dist.get('D')).toBe(3);
    expect(svc.shortestPath(result, 'A', 'D')).toEqual(['A', 'B', 'C', 'D']);
  });

  it('reports the source at zero cost', () => {
    const g = graphOf([['A', 'B', 4]]);
    expect(svc.dijkstra(g, 'A').dist.get('A')).toBe(0);
  });

  it('leaves unreachable nodes at Infinity with no path', () => {
    const g = graphOf([['A', 'B', 2]], ['Z']);
    const result = svc.dijkstra(g, 'A');

    expect(result.dist.get('Z')).toBe(Infinity);
    expect(svc.shortestPath(result, 'A', 'Z')).toEqual([]);
  });

  it('settles every node exactly once even with stale queue entries', () => {
    // Repeated relaxations of D push duplicates into the heap.
    const g = graphOf([
      ['A', 'B', 1],
      ['A', 'C', 5],
      ['B', 'C', 1],
      ['C', 'D', 1],
      ['B', 'D', 9],
    ]);

    const result = svc.dijkstra(g, 'A');

    expect(result.dist.get('C')).toBe(2);
    expect(result.dist.get('D')).toBe(3);
    expect(svc.shortestPath(result, 'A', 'D')).toEqual(['A', 'B', 'C', 'D']);
  });

  it('returns an empty result for a source outside the graph', () => {
    const g = graphOf([['A', 'B', 1]]);
    const result = svc.dijkstra(g, 'MISSING');
    expect(result.dist.get('A')).toBe(Infinity);
  });
});

describe('RouteOptimizerService — geometry and graph', () => {
  const svc = optimizer();

  it('measures a known distance', () => {
    // Kuppam branch → Palace Road warehouse, ~0.3 km apart.
    const km = svc.haversineKm(
      { lat: 12.7395868, lng: 78.3487949 },
      { lat: 12.739921, lng: 78.345363 },
    );
    expect(km).toBeGreaterThan(0.2);
    expect(km).toBeLessThan(0.5);
  });

  it('connects isolated clusters so every stop is reachable', () => {
    // Two tight clusters far apart; k=2 alone would leave them disconnected.
    const nodes: GeoNode[] = [
      { id: 'a1', lat: 12.97, lng: 77.75 },
      { id: 'a2', lat: 12.971, lng: 77.751 },
      { id: 'a3', lat: 12.972, lng: 77.752 },
      { id: 'b1', lat: 12.94, lng: 77.59 },
      { id: 'b2', lat: 12.941, lng: 77.591 },
      { id: 'b3', lat: 12.942, lng: 77.592 },
    ];

    const graph = svc.buildGraph(nodes, 2);
    const reach = svc.dijkstra(graph, 'a1').dist;

    for (const node of nodes) {
      expect(Number.isFinite(reach.get(node.id) ?? Infinity)).toBe(true);
    }
  });
});

describe('RouteOptimizerService — run sequencing', () => {
  const svc = optimizer();

  // Depot plus four stops laid out along a line; the input order zig-zags.
  const nodes: GeoNode[] = [
    { id: 'depot', lat: 12.90, lng: 77.60 },
    { id: 'far', lat: 12.94, lng: 77.60 },
    { id: 'near', lat: 12.91, lng: 77.60 },
    { id: 'mid', lat: 12.92, lng: 77.60 },
    { id: 'further', lat: 12.93, lng: 77.60 },
  ];

  it('visits every stop exactly once, starting at the depot', () => {
    const route = svc.optimiseSequence(nodes, 'depot');

    expect(route.order[0]).toBe('depot');
    expect(route.order).toHaveLength(nodes.length);
    expect(new Set(route.order).size).toBe(nodes.length);
  });

  it('orders collinear stops by distance from the depot', () => {
    const route = svc.optimiseSequence(nodes, 'depot');
    expect(route.order).toEqual(['depot', 'near', 'mid', 'further', 'far']);
  });

  it('beats the zig-zag order it was given', () => {
    const route = svc.optimiseSequence(nodes, 'depot');

    const graph = svc.buildGraph(nodes);
    const naive = ['depot', 'far', 'near', 'further', 'mid'];
    const naiveKm = naive
      .slice(0, -1)
      .reduce((sum, id, i) => sum + (svc.dijkstra(graph, id).dist.get(naive[i + 1]) ?? 0), 0);

    expect(route.total_km).toBeLessThan(naiveKm);
  });

  it('emits a leg per hop with the nodes it routes through', () => {
    const route = svc.optimiseSequence(nodes, 'depot');

    expect(route.legs).toHaveLength(route.order.length - 1);
    for (const leg of route.legs) {
      expect(leg.via[0]).toBe(leg.from);
      expect(leg.via[leg.via.length - 1]).toBe(leg.to);
      expect(leg.distance_km).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles a single stop and an empty run', () => {
    expect(svc.optimiseSequence([], 'depot')).toEqual({ order: [], legs: [], total_km: 0 });

    const single = svc.optimiseSequence([{ id: 'depot', lat: 12.9, lng: 77.6 }], 'depot');
    expect(single.order).toEqual(['depot']);
    expect(single.total_km).toBe(0);
  });

  it('rejects a start node that is not in the route', () => {
    expect(() => svc.optimiseSequence(nodes, 'nowhere')).toThrow();
  });
});
