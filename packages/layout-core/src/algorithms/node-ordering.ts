import { Graph } from '../graph/graph';
import { RankMap, OrderingMap } from '../types';

export function orderNodes(graph: Graph, ranks: RankMap): OrderingMap {
  const ordering: OrderingMap = new Map();

  ranks.forEach((rank, id) => {
    if (!ordering.has(rank)) ordering.set(rank, []);
    ordering.get(rank)!.push(id);
  });

  const sortedRanks = [...ordering.keys()].sort((a, b) => a - b);

  // Start from a deterministic baseline so barycenter ties stay stable.
  ordering.forEach((nodes) => nodes.sort());

  const getNeighborIndices = (
    nodeId: string,
    adjacentRankOrder: string[],
    direction: 'incoming' | 'outgoing'
  ): number[] => {
    const node = graph.getNode(nodeId);

    if (!node || adjacentRankOrder.length === 0) {
      return [];
    }

    const neighbors =
      direction === 'incoming'
        ? [...node.incoming].filter(
            (neighborId) => ranks.get(neighborId) === ranks.get(nodeId)! - 1
          )
        : [...node.outgoing].filter(
            (neighborId) => ranks.get(neighborId) === ranks.get(nodeId)! + 1
          );

    return neighbors
      .map((neighborId) => adjacentRankOrder.indexOf(neighborId))
      .filter((index) => index >= 0);
  };

  const average = (values: number[]): number =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

  // Forward sweep: order each rank by the barycenter of its parents.
  for (let i = 1; i < sortedRanks.length; i++) {
    const rank = sortedRanks[i];
    const previousRank = sortedRanks[i - 1];
    const nodes = ordering.get(rank);
    const previousNodes = ordering.get(previousRank);

    if (!nodes || !previousNodes) {
      continue;
    }

    nodes.sort((left, right) => {
      const leftParents = getNeighborIndices(left, previousNodes, 'incoming');
      const rightParents = getNeighborIndices(right, previousNodes, 'incoming');

      const leftScore =
        leftParents.length > 0 ? average(leftParents) : Number.POSITIVE_INFINITY;
      const rightScore =
        rightParents.length > 0
          ? average(rightParents)
          : Number.POSITIVE_INFINITY;

      if (leftScore !== rightScore) {
        return leftScore - rightScore;
      }

      return left.localeCompare(right);
    });
  }

  // Backward sweep: refine each rank by the barycenter of its children.
  for (let i = sortedRanks.length - 2; i >= 0; i--) {
    const rank = sortedRanks[i];
    const nextRank = sortedRanks[i + 1];
    const nodes = ordering.get(rank);
    const nextNodes = ordering.get(nextRank);

    if (!nodes || !nextNodes) {
      continue;
    }

    nodes.sort((left, right) => {
      const leftChildren = getNeighborIndices(left, nextNodes, 'outgoing');
      const rightChildren = getNeighborIndices(right, nextNodes, 'outgoing');

      const leftScore =
        leftChildren.length > 0
          ? average(leftChildren)
          : Number.POSITIVE_INFINITY;
      const rightScore =
        rightChildren.length > 0
          ? average(rightChildren)
          : Number.POSITIVE_INFINITY;

      if (leftScore !== rightScore) {
        return leftScore - rightScore;
      }

      return left.localeCompare(right);
    });
  }

  return ordering;
}
