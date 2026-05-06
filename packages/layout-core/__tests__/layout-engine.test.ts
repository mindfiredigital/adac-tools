import { CustomLayoutEngine } from '../src';

describe('CustomLayoutEngine', () => {
  test('basic TB layout works and places child below parent', () => {
    const engine = new CustomLayoutEngine({ rankdir: 'TB' });

    engine.addNode('A', { width: 100, height: 50 });
    engine.addNode('B', { width: 100, height: 50 });
    engine.addEdge('A', 'B');

    const result = engine.layout();

    expect(result.nodes.A).toBeDefined();
    expect(result.nodes.B).toBeDefined();
    expect(result.nodes.B.y).toBeGreaterThan(result.nodes.A.y);
    expect(Object.keys(result.edges)).toHaveLength(1);
  });

  test('LR layout places child to the right of parent', () => {
    const engine = new CustomLayoutEngine({ rankdir: 'LR' });

    engine.addNode('A', { width: 100, height: 50 });
    engine.addNode('B', { width: 100, height: 50 });
    engine.addEdge('A', 'B');

    const result = engine.layout();

    expect(result.nodes.B.x).toBeGreaterThan(result.nodes.A.x);
    expect(result.nodes.B.y).toBeGreaterThanOrEqual(0);
  });

  test('routes edges orthogonally', () => {
    const engine = new CustomLayoutEngine({ rankdir: 'TB' });

    engine.addNode('A', { width: 100, height: 50 });
    engine.addNode('B', { width: 100, height: 50 });
    engine.addEdge('A', 'B');

    const result = engine.layout();
    const edge = result.edges.e0;

    expect(edge).toBeDefined();
    expect(edge.points).toHaveLength(4);

    for (let i = 1; i < edge.points.length; i++) {
      const prev = edge.points[i - 1];
      const curr = edge.points[i];
      expect(prev.x === curr.x || prev.y === curr.y).toBe(true);
    }
  });
});
