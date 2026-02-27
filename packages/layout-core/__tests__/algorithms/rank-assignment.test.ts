import { Graph } from '../../src/graph/graph';
import { assignRanks } from '../../src/algorithms/rank-assignment';

describe('Rank Assignment', () => {
  const NODE = { width: 100, height: 50 };

  test('assigns correct ranks in chain', () => {
    const graph = new Graph();
    graph.addNode('A', NODE);
    graph.addNode('B', NODE);
    graph.addNode('C', NODE);

    graph.addEdge('A', 'B');
    graph.addEdge('B', 'C');

    const ranks = assignRanks(graph);

    expect(ranks.get('A')).toBe(0);
    expect(ranks.get('B')).toBe(1);
    expect(ranks.get('C')).toBe(2);
  });
});
