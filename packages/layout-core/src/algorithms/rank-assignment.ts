import { Graph } from '../graph/graph';
import { RankMap } from '../types';
import { topologicalSort } from './topological-sort';

export function assignRanks(graph: Graph): RankMap {
  const order = topologicalSort(graph);
  const ranks: RankMap = new Map();

  order.forEach((id) => ranks.set(id, 0));

  order.forEach((id) => {
    const node = graph.getNode(id);
    node?.outgoing.forEach((next) => {
      ranks.set(next, Math.max(ranks.get(next)!, ranks.get(id)! + 1));
    });
  });

  return ranks;
}
