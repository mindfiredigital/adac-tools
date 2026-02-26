import { Graph } from '../../src/graph/graph';
import { detectCycles } from '../../src/algorithms/cycle-detection';

describe('Cycle Detection', () => {
  const NODE = { width: 100, height: 50 };

  test('returns empty for DAG', () => {
    const graph = new Graph();

    graph.addNode('A', NODE);
    graph.addNode('B', NODE);
    graph.addEdge('A', 'B');

    const cycles = detectCycles(graph);

    expect(cycles).toHaveLength(0);
  });

  test('detects simple cycle', () => {
    const graph = new Graph();

    graph.addNode('A', NODE);
    graph.addNode('B', NODE);

    graph.addEdge('A', 'B');
    graph.addEdge('B', 'A');

    const cycles = detectCycles(graph);

    expect(cycles.length).toBeGreaterThan(0);
  });
});
