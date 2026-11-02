import { describe, expect, it } from 'vitest';
import { OrthogonalLayoutEngine } from '../src/orthogonal-layout-engine';

function expectManhattan(points: Array<{ x: number; y: number }>) {
  expect(points.length).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    expect(current.x === next.x || current.y === next.y).toBe(true);
  }
}

function expectPathAvoidsNode(
  points: Array<{ x: number; y: number }>,
  node: { x: number; y: number; width: number; height: number },
  margin = 0
) {
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const left = node.x - margin;
    const right = node.x + node.width + margin;
    const top = node.y - margin;
    const bottom = node.y + node.height + margin;

    if (from.x === to.x) {
      const lo = Math.min(from.y, to.y);
      const hi = Math.max(from.y, to.y);
      expect(
        from.x >= left && from.x <= right && hi >= top && lo <= bottom
      ).toBe(false);
    }

    if (from.y === to.y) {
      const lo = Math.min(from.x, to.x);
      const hi = Math.max(from.x, to.x);
      expect(
        from.y >= top && from.y <= bottom && hi >= left && lo <= right
      ).toBe(false);
    }
  }
}

describe('OrthogonalLayoutEngine', () => {
  it('returns empty bounds for an empty graph', () => {
    const engine = new OrthogonalLayoutEngine();

    const result = engine.layout();

    expect(result.nodes).toEqual({});
    expect(result.edges).toEqual({});
    expect(result.bounds).toEqual({ width: 50, height: 50 });
  });

  it('lays out a single node using sanitized defaults', () => {
    const engine = new OrthogonalLayoutEngine();
    engine.addNode('api', { width: 0, height: Number.NaN });

    const result = engine.layout();

    expect(result.nodes.api).toMatchObject({
      x: 50,
      y: 50,
      width: 96,
      height: 116,
    });
    expect(result.bounds.width).toBeGreaterThan(result.nodes.api.x);
    expect(result.bounds.height).toBeGreaterThan(result.nodes.api.y);
  });

  it('produces deterministic balanced node placement', () => {
    const create = () => {
      const engine = new OrthogonalLayoutEngine({
        nodesep: 100,
        ranksep: 100,
      });
      for (const id of ['api', 'db', 'queue', 'worker']) {
        engine.addNode(id, { width: 100, height: 80 });
      }
      engine.addEdge('api', 'db');
      engine.addEdge('api', 'queue');
      engine.addEdge('worker', 'queue');
      return engine.layout();
    };

    const first = create();
    const second = create();

    expect(first).toEqual(second);
    expect(new Set(Object.values(first.nodes).map((node) => node.x)).size).toBe(
      2
    );
    expect(new Set(Object.values(first.nodes).map((node) => node.y)).size).toBe(
      2
    );
  });

  it('snaps every node position to the 10-unit routing grid', () => {
    const engine = new OrthogonalLayoutEngine({ nodesep: 100, ranksep: 100 });
    for (const id of ['api', 'db', 'queue', 'worker']) {
      engine.addNode(id, { width: 100, height: 80 });
    }
    engine.addEdge('api', 'db');
    engine.addEdge('api', 'queue');
    engine.addEdge('worker', 'queue');

    const result = engine.layout();

    for (const node of Object.values(result.nodes)) {
      expect(node.x % 10).toBe(0);
      expect(node.y % 10).toBe(0);
    }
  });

  it('keeps median alignment consistent across a 4-rank fan-in/fan-out chain', () => {
    const create = () => {
      const engine = new OrthogonalLayoutEngine({
        nodesep: 100,
        ranksep: 100,
      });
      for (const id of ['a', 'b1', 'b2', 'c1', 'c2', 'd']) {
        engine.addNode(id, { width: 100, height: 80 });
      }
      engine.addEdge('a', 'b1');
      engine.addEdge('a', 'b2');
      engine.addEdge('b1', 'c1');
      engine.addEdge('b2', 'c1');
      engine.addEdge('b2', 'c2');
      engine.addEdge('c1', 'd');
      engine.addEdge('c2', 'd');
      return engine.layout();
    };

    const first = create();
    const second = create();

    expect(first).toEqual(second);
    // 'd' is alone on its rank with two parents (c1, c2), so nothing else
    // constrains its position: it must land exactly on their mean x. This
    // only holds if every rank's alignment sweep sees the *final* position
    // of the rank before it, four ranks deep — not a stale mid-sweep value.
    expect(first.nodes.d.x).toBe((first.nodes.c1.x + first.nodes.c2.x) / 2);
  });

  it('lays out nodes left-to-right when rankdir is LR', () => {
    const engine = new OrthogonalLayoutEngine({ rankdir: 'LR' });
    engine.addNode('api', { width: 100, height: 80 });
    engine.addNode('db', { width: 100, height: 80 });
    engine.addEdge('api', 'db', { id: 'api-to-db' });

    const result = engine.layout();

    expect(result.nodes.db.x).toBeGreaterThan(result.nodes.api.x);
    expectManhattan(result.edges['api-to-db'].points);
  });

  it('routes every edge as a strict orthogonal polyline', () => {
    const engine = new OrthogonalLayoutEngine();
    engine.addNode('api', { width: 100, height: 80 });
    engine.addNode('queue', { width: 100, height: 80 });
    engine.addNode('db', { width: 120, height: 90 });
    engine.addEdge('api', 'queue', { id: 'api-to-queue' });
    engine.addEdge('queue', 'db', { id: 'queue-to-db' });

    const result = engine.layout();

    expect(Object.keys(result.edges)).toEqual(['api-to-queue', 'queue-to-db']);
    for (const edge of Object.values(result.edges)) {
      expectManhattan(edge.points);
      for (const point of edge.points) {
        expect(point.x % 10).toBe(0);
        expect(point.y % 10).toBe(0);
      }
    }
  });

  it('reroutes same-row edges around intervening blocks', () => {
    const engine = new OrthogonalLayoutEngine({
      edgeMargin: 28,
      nodesep: 120,
      ranksep: 120,
    });
    engine.addNode('a-source', { width: 100, height: 80 });
    engine.addNode('b-shared-infrastructure', { width: 100, height: 80 });
    engine.addNode('c-target', { width: 100, height: 80 });
    engine.addNode('d-peer', { width: 100, height: 80 });
    engine.addEdge('a-source', 'c-target', { id: 'source-to-target' });
    engine.addEdge('b-shared-infrastructure', 'd-peer', {
      id: 'shared-to-peer',
    });

    const result = engine.layout();
    const path = result.edges['source-to-target'].points;

    expectManhattan(path);
    expectPathAvoidsNode(path, result.nodes['b-shared-infrastructure'], 28);
  });

  it('ignores edges with missing endpoints without impacting valid edges', () => {
    const engine = new OrthogonalLayoutEngine();
    engine.addNode('api', { width: 100, height: 80 });
    engine.addNode('db', { width: 100, height: 80 });
    engine.addEdge('api', 'missing', { id: 'bad-edge' });
    engine.addEdge('api', 'db', { id: 'good-edge' });

    const result = engine.layout();

    expect(result.edges['bad-edge']).toBeUndefined();
    expect(result.edges['good-edge']).toBeDefined();
    expectManhattan(result.edges['good-edge'].points);
  });

  it('routes self loops outside the node box', () => {
    const engine = new OrthogonalLayoutEngine();
    engine.addNode('cache', { width: 100, height: 80 });
    engine.addEdge('cache', 'cache', { id: 'cache-loop' });

    const result = engine.layout();
    const node = result.nodes.cache;
    const loop = result.edges['cache-loop'].points;

    expectManhattan(loop);
    expect(loop.some((point) => point.x > node.x + node.width)).toBe(true);
    expect(loop.some((point) => point.y > node.y + node.height)).toBe(true);
  });
});
