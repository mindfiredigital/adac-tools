import { Graph } from '../graph/graph';
import { RankMap, OrderingMap } from '../types';

export function orderNodes(graph: Graph, ranks: RankMap): OrderingMap {
  const ordering: OrderingMap = new Map();

  ranks.forEach((rank, id) => {
    if (!ordering.has(rank)) ordering.set(rank, []);
    ordering.get(rank)!.push(id);
  });

  // Simple sort by parent average rank (minimal heuristic)
  ordering.forEach((nodes) => nodes.sort());

  return ordering;
}
