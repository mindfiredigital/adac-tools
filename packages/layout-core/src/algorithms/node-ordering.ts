import { Graph } from '../graph/graph';
import { RankMap, OrderingMap, LayoutOptions } from '../types';
import { computeMedian } from './math-utils';

export function orderNodes(
  graph: Graph,
  ranks: RankMap,
  options: Required<LayoutOptions>
): OrderingMap {
  const ordering: OrderingMap = new Map();

  // Initial ordering based on rank — use DFS order for a better starting point
  ranks.forEach((rank, id) => {
    if (!ordering.has(rank)) ordering.set(rank, []);
    ordering.get(rank)!.push(id);
  });

  // Sort initial ordering within each rank by median of neighbor positions
  // to get a reasonable starting state
  const sortedRanks = Array.from(ordering.keys()).sort((a, b) => a - b);

  // The engine constructor applies the default; honor explicit caller values here.
  const maxIterations = options.maxIterations;
  const rankIndexMap = new Map<number, number>(
    sortedRanks.map((rank, index) => [rank, index])
  );

  let bestCrossings = countTotalCrossings(graph, ordering);
  let bestOrdering = cloneOrdering(ordering);

  for (let i = 0; i < maxIterations; i++) {
    const isForward = i % 2 === 0;

    if (isForward) {
      for (let ri = 1; ri < sortedRanks.length; ri++) {
        medianSweep(graph, ordering, sortedRanks[ri], sortedRanks[ri - 1]);
      }
    } else {
      for (let ri = sortedRanks.length - 2; ri >= 0; ri--) {
        medianSweep(graph, ordering, sortedRanks[ri], sortedRanks[ri + 1]);
      }
    }

    // Transpose step: try swapping adjacent node pairs to reduce crossings
    transpose(graph, ordering, sortedRanks, rankIndexMap);

    const crossings = countTotalCrossings(graph, ordering);
    if (crossings < bestCrossings) {
      bestCrossings = crossings;
      bestOrdering = cloneOrdering(ordering);
    }

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
 * Median-based sweep: order nodes by the median position of their neighbors
 * in the reference rank. Median is more robust against outliers than barycenter.
 */
function medianSweep(
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

  const medians = new Map<string, number>();
  nodes.forEach((id, currentIndex) => {
    const node = graph.getNode(id)!;
    const neighbors =
      targetRank > referenceRank ? node.incoming : node.outgoing;

    if (neighbors.size === 0) {
      medians.set(id, currentIndex);
    } else {
      const positions: number[] = [];
      neighbors.forEach((neighborId) => {
        if (refPositions.has(neighborId)) {
          positions.push(refPositions.get(neighborId)!);
        }
      });

      if (positions.length === 0) {
        medians.set(id, currentIndex);
      } else {
        medians.set(id, computeMedian(positions));
      }
    }
  });

  nodes.sort((a, b) => medians.get(a)! - medians.get(b)!);
}

/**
 * Transpose: iteratively swap adjacent nodes if doing so reduces crossings.
 * This is a local search that catches improvements the sweep misses.
 *
 * Complexity Trade-off:
 * The worst-case complexity per pass is O(r * n * E log E), as it re-counts
 * crossings for every adjacent pair swap attempt across r ranks and n nodes.
 * For very large graphs, consider tuning down `maxIterations`.
 */
function transpose(
  graph: Graph,
  ordering: OrderingMap,
  sortedRanks: number[],
  rankIndexMap: Map<number, number>
) {
  let improved = true;

  while (improved) {
    improved = false;
    for (const rank of sortedRanks) {
      const nodes = ordering.get(rank)!;
      for (let i = 0; i < nodes.length - 1; i++) {
        const crossingsBefore = countAdjacentCrossings(
          graph,
          ordering,
          rank,
          sortedRanks,
          rankIndexMap
        );

        // Swap
        [nodes[i], nodes[i + 1]] = [nodes[i + 1], nodes[i]];

        const crossingsAfter = countAdjacentCrossings(
          graph,
          ordering,
          rank,
          sortedRanks,
          rankIndexMap
        );

        if (crossingsAfter < crossingsBefore) {
          improved = true;
        } else {
          // Swap back
          [nodes[i], nodes[i + 1]] = [nodes[i + 1], nodes[i]];
        }
      }
    }
  }
}

/**
 * Count crossings involving a specific rank and its neighbors.
 */
function countAdjacentCrossings(
  graph: Graph,
  ordering: OrderingMap,
  rank: number,
  sortedRanks: number[],
  rankIndexMap: Map<number, number>
): number {
  let total = 0;
  const ri = rankIndexMap.get(rank);
  if (ri === undefined) return total;

  if (ri > 0) {
    total += countCrossingsBetween(graph, ordering, sortedRanks[ri - 1], rank);
  }
  if (ri < sortedRanks.length - 1) {
    total += countCrossingsBetween(graph, ordering, rank, sortedRanks[ri + 1]);
  }

  return total;
}

/**
 * Count crossings between two adjacent ranks using an accumulator tree
 * for O(|E| log |V|) performance instead of O(|E|²).
 */
function countCrossingsBetween(
  graph: Graph,
  ordering: OrderingMap,
  topRank: number,
  botRank: number
): number {
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

  // Sort by top position, then by bottom position
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  // Count inversions in bottom positions using merge sort
  const botPositions = edges.map((e) => e[1]);
  return countInversions(botPositions);
}

/**
 * Count inversions using merge sort — O(n log n).
 */
function countInversions(arr: number[]): number {
  if (arr.length <= 1) return 0;

  const mid = Math.floor(arr.length / 2);
  const left = arr.slice(0, mid);
  const right = arr.slice(mid);

  let count = countInversions(left) + countInversions(right);

  let i = 0,
    j = 0,
    k = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) {
      arr[k++] = left[i++];
    } else {
      count += left.length - i;
      arr[k++] = right[j++];
    }
  }
  while (i < left.length) arr[k++] = left[i++];
  while (j < right.length) arr[k++] = right[j++];

  return count;
}

/**
 * Count total edge crossings across all adjacent rank pairs.
 */
function countTotalCrossings(graph: Graph, ordering: OrderingMap): number {
  let total = 0;
  const sortedRanks = Array.from(ordering.keys()).sort((a, b) => a - b);

  for (let ri = 0; ri < sortedRanks.length - 1; ri++) {
    total += countCrossingsBetween(
      graph,
      ordering,
      sortedRanks[ri],
      sortedRanks[ri + 1]
    );
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
