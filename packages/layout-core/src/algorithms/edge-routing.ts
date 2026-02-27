import { Graph } from '../graph/graph';
import { PositionedNode, EdgePath, LayoutOptions } from '../types';

export function routeEdges(
  graph: Graph,
  positions: Record<string, PositionedNode>,
  options: Required<LayoutOptions>
): Record<string, EdgePath> {
  const result: Record<string, EdgePath> = {};

  graph.edges.forEach((edge, index) => {
    const from = positions[edge.from];
    const to = positions[edge.to];

    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;

    result[`e${index}`] = {
      points:
        options.rankdir === 'TB'
          ? [
              { x: from.x + from.width / 2, y: from.y + from.height },
              { x: from.x + from.width / 2, y: midY },
              { x: to.x + to.width / 2, y: midY },
              { x: to.x + to.width / 2, y: to.y },
            ]
          : [
              { x: from.x + from.width, y: from.y + from.height / 2 },
              { x: midX, y: from.y + from.height / 2 },
              { x: midX, y: to.y + to.height / 2 },
              { x: to.x, y: to.y + to.height / 2 },
            ],
    };
  });

  return result;
}
