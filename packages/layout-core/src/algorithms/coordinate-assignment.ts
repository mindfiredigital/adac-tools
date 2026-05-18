import { Graph } from '../graph/graph';
import { RankMap, OrderingMap, NodePosition, LayoutOptions } from '../types';

export function assignCoordinates(
  graph: Graph,
  ranks: RankMap,
  ordering: OrderingMap,
  options: Required<LayoutOptions>
): Record<string, NodePosition> {
  const positions: Record<string, NodePosition> = {};
  const isHorizontal = options.rankdir === 'LR';

  // ── Pass 1: Assign primary axis positions (rank direction) ──
  // TB → Y increases per rank; LR → X increases per rank.
  let currentOffset = isHorizontal ? options.marginx : options.marginy;

  const sortedRanks = Array.from(ordering.keys()).sort((a, b) => a - b);

  // Pre-compute max breadth per rank so containers / tall nodes don't overlap
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
        // Center the node within the rank's breadth band
        node.x = currentOffset + (breadth - node.width) / 2;
      } else {
        node.y = currentOffset + (breadth - node.height) / 2;
      }
    });
    currentOffset += breadth + options.ranksep;
  });

  // ── Pass 2 (forward): Assign secondary axis based on ordering + neighbor centering ──
  sortedRanks.forEach((rank) => {
    const nodes = ordering.get(rank)!;
    const margin = isHorizontal ? options.marginy : options.marginx;
    let currentPos = margin;

    nodes.forEach((id) => {
      const node = graph.getNode(id)!;

      // Try to center based on neighbors in previous rank
      const neighbors = node.incoming;
      let targetPos = currentPos;

      if (neighbors.size > 0) {
        let sum = 0;
        let count = 0;
        neighbors.forEach((neighborId) => {
          const neighbor = graph.getNode(neighborId)!;
          if (isHorizontal) {
            sum += neighbor.y + neighbor.height / 2;
          } else {
            sum += neighbor.x + neighbor.width / 2;
          }
          count++;
        });
        const center = sum / count;
        const halfSize = isHorizontal ? node.height / 2 : node.width / 2;
        targetPos = Math.max(currentPos, center - halfSize);
      }

      if (isHorizontal) {
        node.y = targetPos;
        currentPos = node.y + node.height + options.nodesep;
      } else {
        node.x = targetPos;
        currentPos = node.x + node.width + options.nodesep;
      }
    });
  });

  // ── Pass 3 (backward): Improve alignment by pulling nodes toward children ──
  // This reduces unnecessary zig-zag in edges and tightens the layout.
  for (let ri = sortedRanks.length - 2; ri >= 0; ri--) {
    const rank = sortedRanks[ri];
    const nodes = ordering.get(rank)!;

    nodes.forEach((id) => {
      const node = graph.getNode(id)!;
      if (node.outgoing.size === 0) return;

      let sum = 0;
      let count = 0;
      node.outgoing.forEach((childId) => {
        const child = graph.getNode(childId)!;
        if (isHorizontal) {
          sum += child.y + child.height / 2;
        } else {
          sum += child.x + child.width / 2;
        }
        count++;
      });
      if (count === 0) return;

      const childCenter = sum / count;
      const halfSize = isHorizontal ? node.height / 2 : node.width / 2;
      const desired = childCenter - halfSize;

      // Only move toward children if it doesn't violate minimum separation
      const idx = nodes.indexOf(id);
      let minPos = isHorizontal ? options.marginy : options.marginx;
      if (idx > 0) {
        const prevId = nodes[idx - 1];
        const prevNode = graph.getNode(prevId)!;
        minPos = isHorizontal
          ? prevNode.y + prevNode.height + options.nodesep
          : prevNode.x + prevNode.width + options.nodesep;
      }

      const newPos = Math.max(minPos, desired);
      if (isHorizontal) {
        node.y = newPos;
      } else {
        node.x = newPos;
      }
    });
  }

  // ── Pass 4: Compact by centering each rank within its used span ──
  // Find the total secondary-axis span and center ranks that are narrower.
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

    const COMPACTION_THRESHOLD = 0.9;
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

  // ── Collect results ──
  graph.nodes.forEach((node, id) => {
    positions[id] = {
      x: Math.round(node.x),
      y: Math.round(node.y),
      width: node.width,
      height: node.height,
    };
  });

  return positions;
}
