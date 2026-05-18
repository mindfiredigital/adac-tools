import { Graph } from '../graph/graph';
import { RankMap, OrderingMap, LayoutOptions } from '../types';

export function orderNodes(
  graph: Graph,
  ranks: RankMap,
  options: Required<LayoutOptions>
): OrderingMap {
  const ordering: OrderingMap = new Map();

  // Initial ordering based on rank
  ranks.forEach((rank, id) => {
    if (!ordering.has(rank)) ordering.set(rank, []);
    ordering.get(rank)!.push(id);
  });

  // Perform multiple sweeps to reduce crossings (more iterations = fewer crossings)
  const maxIterations = options.maxIterations;

  let bestCrossings = countTotalCrossings(graph, ordering);
  let bestOrdering = cloneOrdering(ordering);

  for (let i = 0; i < maxIterations; i++) {
    const isForward = i % 2 === 0;
    const sortedRanks = Array.from(ordering.keys()).sort((a, b) => a - b);

    if (isForward) {
      for (let ri = 1; ri < sortedRanks.length; ri++) {
        sweep(graph, ordering, sortedRanks[ri], sortedRanks[ri - 1]);
      }
    } else {
      for (let ri = sortedRanks.length - 2; ri >= 0; ri--) {
        sweep(graph, ordering, sortedRanks[ri], sortedRanks[ri + 1]);
      }
    }

    const crossings = countTotalCrossings(graph, ordering);
    if (crossings < bestCrossings) {
      bestCrossings = crossings;
      bestOrdering = cloneOrdering(ordering);
    }

    // Converged — no crossings left
    if (crossings === 0) break;
  }

  // Restore best ordering found
  bestOrdering.forEach((nodes, rank) => {
    ordering.set(rank, nodes);
  });

  // Finalize order index on nodes
  ordering.forEach((nodes) => {
    nodes.forEach((id, index) => {
      const node = graph.getNode(id);
      if (node) node.order = index;
    });
  });

  return ordering;
}

/**
 * Perform a single sweep to reorder nodes in a rank based on their neighbors in another rank.
 */
function sweep(
  graph: Graph,
  ordering: OrderingMap,
  targetRank: number,
  referenceRank: number
) {
  const nodes = ordering.get(targetRank);
  if (!nodes) return;

  const refNodes = ordering.get(referenceRank);
  if (!refNodes) return;

  const refPositions = new Map<string, number>();
  refNodes.forEach((id, index) => refPositions.set(id, index));

  const barycenters = new Map<string, number>();
  nodes.forEach((id, currentIndex) => {
    const node = graph.getNode(id)!;
    const neighbors =
      targetRank > referenceRank ? node.incoming : node.outgoing;

    if (neighbors.size === 0) {
      // Disconnected nodes keep their current relative position
      // instead of all piling at position 0
      barycenters.set(id, currentIndex);
    } else {
      let sum = 0;
      let count = 0;
      neighbors.forEach((neighborId) => {
        if (refPositions.has(neighborId)) {
          sum += refPositions.get(neighborId)!;
          count++;
        }
      });
      barycenters.set(id, count === 0 ? currentIndex : sum / count);
    }
  });

  nodes.sort((a, b) => barycenters.get(a)! - barycenters.get(b)!);
}

/**
 * Count total edge crossings across all adjacent rank pairs.
 */
function countTotalCrossings(graph: Graph, ordering: OrderingMap): number {
  let total = 0;
  const sortedRanks = Array.from(ordering.keys()).sort((a, b) => a - b);

  for (let ri = 0; ri < sortedRanks.length - 1; ri++) {
    const topRank = sortedRanks[ri];
    const botRank = sortedRanks[ri + 1];
    const topNodes = ordering.get(topRank)!;
    const botNodes = ordering.get(botRank)!;

    const topPos = new Map<string, number>();
    topNodes.forEach((id, i) => topPos.set(id, i));
    const botPos = new Map<string, number>();
    botNodes.forEach((id, i) => botPos.set(id, i));

    // Collect all edges between these two ranks as (topIndex, botIndex)
    const edges: [number, number][] = [];
    topNodes.forEach((id) => {
      const node = graph.getNode(id)!;
      node.outgoing.forEach((childId) => {
        if (botPos.has(childId)) {
          edges.push([topPos.get(id)!, botPos.get(childId)!]);
        }
      });
    });

    // Count crossings via simple pairwise comparison
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        if (
          (edges[i][0] < edges[j][0] && edges[i][1] > edges[j][1]) ||
          (edges[i][0] > edges[j][0] && edges[i][1] < edges[j][1])
        ) {
          total++;
        }
      }
    }
  }

  return total;
}

function cloneOrdering(ordering: OrderingMap): OrderingMap {
  const clone: OrderingMap = new Map();
  ordering.forEach((nodes, rank) => {
    clone.set(rank, [...nodes]);
  });
  return clone;
}
