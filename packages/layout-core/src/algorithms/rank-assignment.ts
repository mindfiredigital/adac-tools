import { Graph } from '../graph/graph';
import { RankMap } from '../types';
import { topologicalSort } from './topological-sort';

export function assignRanks(graph: Graph): RankMap {
  const order = topologicalSort(graph);
  const ranks: RankMap = new Map();

  // 1. Forward pass: minimize rank (assign to earliest possible layer)
  const earliest: RankMap = new Map();
  order.forEach((id) => earliest.set(id, 0));

  order.forEach((id) => {
    const node = graph.getNode(id);
    const currentRank = earliest.get(id)!;
    node?.outgoing.forEach((nextId) => {
      const nextRank = earliest.get(nextId)!;
      earliest.set(nextId, Math.max(nextRank, currentRank + 1));
    });
  });

  // 2. Find max rank in the graph
  let maxRank = 0;
  earliest.forEach((rank) => {
    if (rank > maxRank) maxRank = rank;
  });

  // 3. Backward pass: maximize rank (assign to latest possible layer)
  const latest: RankMap = new Map();
  order.forEach((id) => latest.set(id, maxRank));

  const reverseOrder = [...order].reverse();
  reverseOrder.forEach((id) => {
    const node = graph.getNode(id);
    const currentLatest = latest.get(id)!;
    node?.incoming.forEach((prevId) => {
      const prevLatest = latest.get(prevId)!;
      latest.set(prevId, Math.min(prevLatest, currentLatest - 1));
    });
  });

  // 4. Balance ranks: put nodes closer to the middle or their children
  order.forEach((id) => {
    const e = earliest.get(id)!;
    const l = latest.get(id)!;

    // For nodes that have no incoming edges but are connected to nodes deep in the graph,
    // pulling them down to latest or averaging them creates a much more balanced visual.
    // We'll use the average rank (rounded down) to center them.
    const balancedRank = Math.floor((e + l) / 2);
    ranks.set(id, balancedRank);
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
      const isReversed = sourceRank > targetRank;

      // Remove original edge connections from sets to avoid confusion during ordering
      if (isReversed) {
        target.outgoing.delete(edge.from);
        source.incoming.delete(edge.to);
      } else {
        source.outgoing.delete(edge.to);
        target.incoming.delete(edge.from);
      }

      let prevId = edge.from;
      edge.virtualPath = [edge.from];
      const step = isReversed ? -1 : 1;

      for (let r = sourceRank + step; r !== targetRank; r += step) {
        const vId = `__v${virtualNodeCount++}__`;
        const vNode = graph.addVirtualNode(vId);
        vNode.rank = r;

        const topId = isReversed ? vId : prevId;
        const bottomId = isReversed ? prevId : vId;

        const topNode = graph.getNode(topId)!;
        const bottomNode = graph.getNode(bottomId)!;

        topNode.outgoing.add(bottomId);
        bottomNode.incoming.add(topId);

        edge.virtualPath.push(vId);
        prevId = vId;
      }

      const topId = isReversed ? edge.to : prevId;
      const bottomId = isReversed ? prevId : edge.to;

      const topNode = graph.getNode(topId)!;
      const bottomNode = graph.getNode(bottomId)!;

      topNode.outgoing.add(bottomId);
      bottomNode.incoming.add(topId);

      edge.virtualPath.push(edge.to);
    }
  });
}
