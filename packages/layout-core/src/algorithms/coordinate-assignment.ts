import { Graph } from '../graph/graph';
import { RankMap, OrderingMap, PositionedNode, LayoutOptions } from '../types';

export function assignCoordinates(
  graph: Graph,
  ranks: RankMap,
  ordering: OrderingMap,
  options: Required<LayoutOptions>
): Record<string, PositionedNode> {
  const positions: Record<string, PositionedNode> = {};

  ordering.forEach((nodes, rank) => {
    let offset = options.marginx;

    nodes.forEach((id) => {
      const node = graph.getNode(id)!;

      if (options.rankdir === 'TB') {
        positions[id] = {
          x: offset,
          y: rank * options.ranksep + options.marginy,
          width: node.width,
          height: node.height,
        };
      } else {
        positions[id] = {
          x: rank * options.ranksep + options.marginx,
          y: offset,
          width: node.width,
          height: node.height,
        };
      }

      offset += node.width + options.nodesep;
    });
  });

  return positions;
}
