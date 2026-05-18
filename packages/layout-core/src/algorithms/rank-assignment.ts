import { Graph } from '../graph/graph';
import { RankMap } from '../types';
import { topologicalSort } from './topological-sort';

export function assignRanks(graph: Graph): RankMap {
  const order = topologicalSort(graph);
  const ranks: RankMap = new Map();

  // Initial rank 0 for all
  order.forEach((id) => ranks.set(id, 0));

  // Forward pass: minimize rank (assign to earliest possible layer)
  order.forEach((id) => {
    const node = graph.getNode(id);
    const currentRank = ranks.get(id)!;
    node?.outgoing.forEach((nextId) => {
      const nextRank = ranks.get(nextId)!;
      ranks.set(nextId, Math.max(nextRank, currentRank + 1));
    });
  });

  // Assign ranks to nodes
  ranks.forEach((rank, id) => {
    const node = graph.getNode(id);
    if (node) node.rank = rank;
  });

  return ranks;
}

/**
 * Normalization: Insert virtual nodes for edges that span multiple ranks.
 */
export function normalize(graph: Graph) {
  const edges = [...graph.edges];
  let virtualNodeCount = 0;

  edges.forEach((edge) => {
    const source = graph.getNode(edge.from)!;
    const target = graph.getNode(edge.to)!;

    const sourceRank = source.rank;
    const targetRank = target.rank;

    if (Math.abs(sourceRank - targetRank) > 1) {
      // Remove original edge connections from sets to avoid confusion during ordering
      source.outgoing.delete(edge.to);
      target.incoming.delete(edge.from);

      let prevId = edge.from;
      edge.virtualPath = [edge.from];
      const step = targetRank > sourceRank ? 1 : -1;

      for (let r = sourceRank + step; r !== targetRank; r += step) {
        const vId = `__v${virtualNodeCount++}__`;
        const vNode = graph.addVirtualNode(vId);
        vNode.rank = r;

        const prevNode = graph.getNode(prevId)!;
        prevNode.outgoing.add(vId);
        vNode.incoming.add(prevId);

        edge.virtualPath.push(vId);
        prevId = vId;
      }

      const lastPrevNode = graph.getNode(prevId)!;
      lastPrevNode.outgoing.add(edge.to);
      target.incoming.add(prevId);
      edge.virtualPath.push(edge.to);
    }
  });
}
