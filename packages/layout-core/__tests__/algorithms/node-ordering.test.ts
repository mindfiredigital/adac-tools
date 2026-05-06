import { Graph } from '../../src/graph/graph';
import { orderNodes } from '../../src/algorithms/node-ordering';
import { RankMap } from '../../src/types';

describe('Node Ordering', () => {
  const NODE = { width: 100, height: 50 };

  test('orders a rank by parent barycenter instead of simple alphabetical order', () => {
    const graph = new Graph();

    graph.addNode('A', NODE);
    graph.addNode('B', NODE);
    graph.addNode('Y', NODE);
    graph.addNode('Z', NODE);

    graph.addEdge('B', 'Y');
    graph.addEdge('A', 'Z');

    const ranks: RankMap = new Map([
      ['A', 0],
      ['B', 0],
      ['Y', 1],
      ['Z', 1],
    ]);

    const ordering = orderNodes(graph, ranks);

    expect(ordering.get(1)).toEqual(['Z', 'Y']);
  });

  test('keeps deterministic ordering when nodes have no adjacent-rank neighbors', () => {
    const graph = new Graph();

    graph.addNode('B', NODE);
    graph.addNode('A', NODE);

    const ranks: RankMap = new Map([
      ['B', 1],
      ['A', 1],
    ]);

    const ordering = orderNodes(graph, ranks);

    expect(ordering.get(1)).toEqual(['A', 'B']);
  });
});
