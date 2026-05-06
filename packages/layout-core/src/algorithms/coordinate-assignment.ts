import { Graph } from '../graph/graph';
import { RankMap, OrderingMap, NodePosition, LayoutOptions } from '../types';

export function assignCoordinates(
  graph: Graph,
  ranks: RankMap,
  ordering: OrderingMap,
  options: Required<LayoutOptions>
): Record<string, NodePosition> {
  const positions: Record<string, NodePosition> = {};
  const sortedRanks = [...ordering.keys()].sort((a, b) => a - b);

  const rankSizes = new Map<
    number,
    { primary: number; cross: number; nodeSizes: Map<string, number> }
  >();

  for (const rank of sortedRanks) {
    const nodes = ordering.get(rank) ?? [];
    const nodeSizes = new Map<string, number>();
    let primary = 0;
    let cross = 0;

    nodes.forEach((id, index) => {
      const node = graph.getNode(id)!;
      const primarySize =
        options.rankdir === 'TB' ? node.width : node.height;
      const crossSize =
        options.rankdir === 'TB' ? node.height : node.width;

      nodeSizes.set(id, primarySize);
      primary += primarySize;
      if (index > 0) {
        primary += options.nodesep;
      }
      cross = Math.max(cross, crossSize);
    });

    rankSizes.set(rank, { primary, cross, nodeSizes });
  }

  const maxPrimary = Math.max(
    0,
    ...[...rankSizes.values()].map((size) => size.primary)
  );

  let crossOffsetTB = options.marginy;
  let crossOffsetLR = options.marginx;

  for (const rank of sortedRanks) {
    const nodes = ordering.get(rank) ?? [];
    const sizeInfo = rankSizes.get(rank);
    let offset =
      options.marginx +
      Math.max(0, (maxPrimary - (sizeInfo?.primary ?? 0)) / 2);
    let crossOffset =
      options.rankdir === 'TB' ? crossOffsetTB : crossOffsetLR;

    nodes.forEach((id) => {
      const node = graph.getNode(id)!;

      if (options.rankdir === 'TB') {
        positions[id] = {
          x: offset,
          y: crossOffset,
          width: node.width,
          height: node.height,
        };
        offset += node.width + options.nodesep;
      } else {
        positions[id] = {
          x: crossOffset,
          y: offset,
          width: node.width,
          height: node.height,
        };
        offset += node.height + options.nodesep;
      }
    });

    if (options.rankdir === 'TB') {
      crossOffsetTB += (sizeInfo?.cross ?? 0) + options.ranksep;
    } else {
      crossOffsetLR += (sizeInfo?.cross ?? 0) + options.ranksep;
    }
  }

  return positions;
}
