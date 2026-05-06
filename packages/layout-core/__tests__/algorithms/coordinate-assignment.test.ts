import { Graph } from '../../src/graph/graph';
import { assignCoordinates } from '../../src/algorithms/coordinate-assignment';
import { OrderingMap, RankMap } from '../../src/types';

describe('Coordinate Assignment', () => {
  test('centers smaller TB ranks relative to the widest rank', () => {
    const graph = new Graph();

    graph.addNode('A', { width: 100, height: 40 });
    graph.addNode('B', { width: 100, height: 40 });
    graph.addNode('C', { width: 80, height: 40 });

    const ranks: RankMap = new Map([
      ['A', 0],
      ['B', 0],
      ['C', 1],
    ]);

    const ordering: OrderingMap = new Map([
      [0, ['A', 'B']],
      [1, ['C']],
    ]);

    const positions = assignCoordinates(graph, ranks, ordering, {
      rankdir: 'TB',
      nodesep: 20,
      ranksep: 50,
      marginx: 20,
      marginy: 20,
    });

    expect(positions.A.x).toBe(20);
    expect(positions.B.x).toBe(140);
    expect(positions.C.x).toBe(80);
    expect(positions.C.y).toBe(110);
  });

  test('centers smaller LR ranks relative to the tallest rank', () => {
    const graph = new Graph();

    graph.addNode('A', { width: 100, height: 40 });
    graph.addNode('B', { width: 100, height: 40 });
    graph.addNode('C', { width: 100, height: 60 });

    const ranks: RankMap = new Map([
      ['A', 0],
      ['B', 0],
      ['C', 1],
    ]);

    const ordering: OrderingMap = new Map([
      [0, ['A', 'B']],
      [1, ['C']],
    ]);

    const positions = assignCoordinates(graph, ranks, ordering, {
      rankdir: 'LR',
      nodesep: 20,
      ranksep: 50,
      marginx: 20,
      marginy: 20,
    });

    expect(positions.A.y).toBe(20);
    expect(positions.B.y).toBe(80);
    expect(positions.C.y).toBe(50);
    expect(positions.C.x).toBe(170);
  });
});
