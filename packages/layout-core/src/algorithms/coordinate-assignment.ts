import { Graph } from '../graph/graph';
import { RankMap, OrderingMap, NodePosition, LayoutOptions } from '../types';
import { computeMedian } from './math-utils';

const MAX_ALIGNMENT_SWEEPS = 8;
// Narrow ranks below this share of the global span are centered during compaction.
const COMPACTION_THRESHOLD = 0.85;

export function assignCoordinates(
  graph: Graph,
  ranks: RankMap,
  ordering: OrderingMap,
  options: Required<LayoutOptions>
): Record<string, NodePosition> {
  const positions: Record<string, NodePosition> = {};
  const isHorizontal = options.rankdir === 'LR';

  const sortedRanks = Array.from(ordering.keys()).sort((a, b) => a - b);

  // ── Pass 1: Assign primary axis positions (rank direction) ──
  let currentOffset = isHorizontal ? options.marginx : options.marginy;

  const rankBreadth = new Map<number, number>();
  sortedRanks.forEach((rank) => {
    const nodes = ordering.get(rank)!;
    let maxBreadth = 0;
    nodes.forEach((id) => {
      const node = graph.getNode(id)!;
      maxBreadth = Math.max(
        maxBreadth,
        isHorizontal ? node.width : node.height
      );
    });
    rankBreadth.set(rank, maxBreadth);
  });

  sortedRanks.forEach((rank) => {
    const nodes = ordering.get(rank)!;
    const breadth = rankBreadth.get(rank)!;
    nodes.forEach((id) => {
      const node = graph.getNode(id)!;
      if (isHorizontal) {
        node.x = currentOffset + (breadth - node.width) / 2;
      } else {
        node.y = currentOffset + (breadth - node.height) / 2;
      }
    });
    currentOffset += breadth + options.ranksep;
  });

  // ── Pass 2: Initial secondary axis placement ──
  // Place nodes with minimum separation, no neighbor centering yet
  sortedRanks.forEach((rank) => {
    const nodes = ordering.get(rank)!;
    const margin = isHorizontal ? options.marginy : options.marginx;
    let currentPos = margin;

    nodes.forEach((id) => {
      const node = graph.getNode(id)!;
      if (isHorizontal) {
        node.y = currentPos;
        currentPos = node.y + node.height + options.nodesep;
      } else {
        node.x = currentPos;
        currentPos = node.x + node.width + options.nodesep;
      }
    });
  });

  // ── Pass 3: Brandes-Köpf style alignment (multiple passes) ──
  // Do alternating forward/backward sweeps to align nodes with their neighbors
  for (let iter = 0; iter < MAX_ALIGNMENT_SWEEPS; iter++) {
    if (iter % 2 === 0) {
      // Forward: align to parents (incoming neighbors)
      for (let ri = 1; ri < sortedRanks.length; ri++) {
        alignToNeighbors(
          graph,
          ordering,
          sortedRanks[ri],
          'incoming',
          isHorizontal,
          options
        );
      }
    } else {
      // Backward: align to children (outgoing neighbors)
      for (let ri = sortedRanks.length - 2; ri >= 0; ri--) {
        alignToNeighbors(
          graph,
          ordering,
          sortedRanks[ri],
          'outgoing',
          isHorizontal,
          options
        );
      }
    }
  }

  // Alternating sweeps can leave the last-touched rank one step "ahead" of
  // its neighbor when MAX_ALIGNMENT_SWEEPS ends on a backward pass (each
  // sweep cascades left-to-right or right-to-left off values the other
  // direction hasn't seen yet). Finish with one canonical top-down pass so
  // every rank reflects its predecessor's final position instead of a
  // stale mid-sweep value.
  for (let ri = 1; ri < sortedRanks.length; ri++) {
    alignToNeighbors(
      graph,
      ordering,
      sortedRanks[ri],
      'incoming',
      isHorizontal,
      options
    );
  }

  // ── Pass 4: Compaction — center narrow ranks within the global span ──
  let globalMax = 0;
  sortedRanks.forEach((rank) => {
    const nodes = ordering.get(rank)!;
    nodes.forEach((id) => {
      const node = graph.getNode(id)!;
      const extent = isHorizontal ? node.y + node.height : node.x + node.width;
      globalMax = Math.max(globalMax, extent);
    });
  });

  sortedRanks.forEach((rank) => {
    const nodes = ordering.get(rank)!;
    if (nodes.length === 0) return;

    let minPos = Infinity;
    let maxPos = -Infinity;
    nodes.forEach((id) => {
      const node = graph.getNode(id)!;
      const lo = isHorizontal ? node.y : node.x;
      const hi = isHorizontal ? node.y + node.height : node.x + node.width;
      minPos = Math.min(minPos, lo);
      maxPos = Math.max(maxPos, hi);
    });

    const rankSpan = maxPos - minPos;
    if (rankSpan < globalMax * COMPACTION_THRESHOLD) {
      const shift = (globalMax - rankSpan) / 2 - minPos;
      if (shift > 0) {
        nodes.forEach((id) => {
          const node = graph.getNode(id)!;
          if (isHorizontal) {
            node.y += shift;
          } else {
            node.x += shift;
          }
        });
      }
    }
  });

  // ── Final normalization ──
  let minGlobalX = Infinity;
  let minGlobalY = Infinity;
  graph.nodes.forEach((node) => {
    minGlobalX = Math.min(minGlobalX, node.x);
    minGlobalY = Math.min(minGlobalY, node.y);
  });

  const shiftX = options.marginx - minGlobalX;
  const shiftY = options.marginy - minGlobalY;

  // ── Collect results ──
  graph.nodes.forEach((node, id) => {
    positions[id] = {
      x: Math.round(node.x + shiftX),
      y: Math.round(node.y + shiftY),
      width: node.width,
      height: node.height,
    };
  });

  return positions;
}

/**
 * Align nodes within a rank toward their connected neighbors.
 * Uses median of neighbor positions and respects minimum separation.
 */
function alignToNeighbors(
  graph: Graph,
  ordering: OrderingMap,
  rank: number,
  direction: 'incoming' | 'outgoing',
  isHorizontal: boolean,
  options: Required<LayoutOptions>
) {
  const nodes = ordering.get(rank);
  if (!nodes || nodes.length === 0) return;

  // Calculate desired position for each node based on neighbor medians
  const desired = new Map<string, number>();

  nodes.forEach((id) => {
    const node = graph.getNode(id)!;
    const neighbors = direction === 'incoming' ? node.incoming : node.outgoing;

    if (neighbors.size === 0) {
      desired.set(id, isHorizontal ? node.y : node.x);
      return;
    }

    const neighborCenters: number[] = [];
    neighbors.forEach((neighborId) => {
      const neighbor = graph.getNode(neighborId)!;
      if (isHorizontal) {
        neighborCenters.push(neighbor.y + neighbor.height / 2);
      } else {
        neighborCenters.push(neighbor.x + neighbor.width / 2);
      }
    });

    const halfSize = isHorizontal ? node.height / 2 : node.width / 2;
    desired.set(id, computeMedian(neighborCenters) - halfSize);
  });

  // Apply desired positions while maintaining minimum separation
  const margin = isHorizontal ? options.marginy : options.marginx;

  for (let i = 0; i < nodes.length; i++) {
    const id = nodes[i];
    const node = graph.getNode(id)!;
    const des = desired.get(id)!;

    let minPos = margin;
    if (i > 0) {
      const prevId = nodes[i - 1];
      const prevNode = graph.getNode(prevId)!;
      minPos = isHorizontal
        ? prevNode.y + prevNode.height + options.nodesep
        : prevNode.x + prevNode.width + options.nodesep;
    }

    const newPos = Math.max(minPos, des);
    if (isHorizontal) {
      node.y = newPos;
    } else {
      node.x = newPos;
    }
  }
}
