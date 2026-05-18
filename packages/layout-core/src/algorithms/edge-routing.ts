import { Graph } from '../graph/graph';
import { NodePosition, EdgePath, LayoutOptions } from '../types';

/**
 * Route edges with orthogonal (right-angle) paths that avoid overlapping
 * intermediate nodes.  Uses port-offset distribution so multiple edges
 * leaving/entering the same node are spread across the node's face.
 */
export function routeEdges(
  graph: Graph,
  positions: Record<string, NodePosition>,
  options: Required<LayoutOptions>
): Record<string, EdgePath> {
  const result: Record<string, EdgePath> = {};
  const isHorizontal = options.rankdir === 'LR';

  // ── Pre-compute node bounding boxes for collision detection ──
  const boxes: { id: string; x: number; y: number; r: number; b: number }[] =
    [];
  for (const [id, pos] of Object.entries(positions)) {
    const node = graph.getNode(id);
    if (node && !node.isVirtual) {
      boxes.push({
        id,
        x: pos.x,
        y: pos.y,
        r: pos.x + pos.width,
        b: pos.y + pos.height,
      });
    }
  }

  // ── Pre-compute port allocations ──
  // For each node, count how many edges leave / enter so we can spread
  // connection points evenly along the appropriate face.
  const outCount = new Map<string, number>();
  const inCount = new Map<string, number>();
  const outUsed = new Map<string, number>();
  const inUsed = new Map<string, number>();

  graph.edges.forEach((edge) => {
    outCount.set(edge.from, (outCount.get(edge.from) || 0) + 1);
    inCount.set(edge.to, (inCount.get(edge.to) || 0) + 1);
  });

  /**
   * Return the next port offset for node `id` on the outgoing face.
   * Ports are spread symmetrically around the center of the face.
   */
  function nextOutPort(id: string, faceLength: number): number {
    const total = outCount.get(id) || 1;
    const used = outUsed.get(id) || 0;
    outUsed.set(id, used + 1);

    const spacing = Math.min(18, faceLength / (total + 1));
    return (used + 1) * spacing - ((total + 1) * spacing) / 2;
  }

  function nextInPort(id: string, faceLength: number): number {
    const total = inCount.get(id) || 1;
    const used = inUsed.get(id) || 0;
    inUsed.set(id, used + 1);

    const spacing = Math.min(18, faceLength / (total + 1));
    return (used + 1) * spacing - ((total + 1) * spacing) / 2;
  }

  /**
   * Check if a horizontal segment at `y` between `x1` and `x2` overlaps
   * any node box (excluding `skipIds`).  Returns the colliding box or null.
   */
  function hitsHorizontal(
    y: number,
    x1: number,
    x2: number,
    skipIds: Set<string>,
    margin: number
  ): (typeof boxes)[0] | null {
    const lo = Math.min(x1, x2);
    const hi = Math.max(x1, x2);
    for (const box of boxes) {
      if (skipIds.has(box.id)) continue;
      if (
        y > box.y - margin &&
        y < box.b + margin &&
        hi > box.x - margin &&
        lo < box.r + margin
      ) {
        return box;
      }
    }
    return null;
  }

  /**
   * Check if a vertical segment at `x` between `y1` and `y2` overlaps
   * any node box (excluding `skipIds`).  Returns the colliding box or null.
   */
  function hitsVertical(
    x: number,
    y1: number,
    y2: number,
    skipIds: Set<string>,
    margin: number
  ): (typeof boxes)[0] | null {
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    for (const box of boxes) {
      if (skipIds.has(box.id)) continue;
      if (
        x > box.x - margin &&
        x < box.r + margin &&
        hi > box.y - margin &&
        lo < box.b + margin
      ) {
        return box;
      }
    }
    return null;
  }

  /**
   * Nudge a horizontal midline `y` to avoid all collisions along [x1..x2].
   */
  function clearHorizontalY(
    y: number,
    x1: number,
    x2: number,
    skipIds: Set<string>,
    margin: number
  ): number {
    for (let pass = 0; pass < 8; pass++) {
      const hit = hitsHorizontal(y, x1, x2, skipIds, margin);
      if (!hit) return y;
      // Go above or below whichever is closer
      const above = hit.y - margin;
      const below = hit.b + margin;
      y = Math.abs(y - above) <= Math.abs(y - below) ? above : below;
    }
    return y;
  }

  /**
   * Nudge a vertical midline `x` to avoid all collisions along [y1..y2].
   */
  function clearVerticalX(
    x: number,
    y1: number,
    y2: number,
    skipIds: Set<string>,
    margin: number
  ): number {
    for (let pass = 0; pass < 8; pass++) {
      const hit = hitsVertical(x, y1, y2, skipIds, margin);
      if (!hit) return x;
      const left = hit.x - margin;
      const right = hit.r + margin;
      x = Math.abs(x - left) <= Math.abs(x - right) ? left : right;
    }
    return x;
  }

  // Clearance around nodes for edge routing
  const MARGIN = 12;

  graph.edges.forEach((edge, index) => {
    const path = edge.virtualPath || [edge.from, edge.to];
    const points: { x: number; y: number }[] = [];

    const skipIds = new Set<string>([edge.from, edge.to]);

    // If there's a virtual path, trace through the virtual nodes
    if (path.length > 2) {
      for (let i = 0; i < path.length; i++) {
        const nodeId = path[i];
        const node = graph.getNode(nodeId)!;
        if (i === 0) {
          // Start from the exit face of the source
          if (isHorizontal) {
            points.push({
              x: Math.round(node.x + node.width),
              y: Math.round(node.y + node.height / 2),
            });
          } else {
            points.push({
              x: Math.round(node.x + node.width / 2),
              y: Math.round(node.y + node.height),
            });
          }
        } else if (i === path.length - 1) {
          // End at the entry face of the target
          if (isHorizontal) {
            points.push({
              x: Math.round(node.x),
              y: Math.round(node.y + node.height / 2),
            });
          } else {
            points.push({
              x: Math.round(node.x + node.width / 2),
              y: Math.round(node.y),
            });
          }
        } else {
          // Virtual node — use its center as a waypoint
          points.push({ x: Math.round(node.x), y: Math.round(node.y) });
        }
      }
    } else {
      // Direct edge (source → target on adjacent ranks)
      const srcId = edge.from;
      const tgtId = edge.to;
      const src = graph.getNode(srcId)!;
      const tgt = graph.getNode(tgtId)!;

      if (isHorizontal) {
        // LR: exit from right face, enter left face
        const srcFace = src.height;
        const tgtFace = tgt.height;
        const srcPort = nextOutPort(srcId, srcFace);
        const tgtPort = nextInPort(tgtId, tgtFace);

        const startX = Math.round(src.x + src.width);
        const startY = Math.round(src.y + src.height / 2 + srcPort);
        const endX = Math.round(tgt.x);
        const endY = Math.round(tgt.y + tgt.height / 2 + tgtPort);

        points.push({ x: startX, y: startY });

        if (startY !== endY) {
          const preferredMidX = Math.round((startX + endX) / 2);
          const midX = clearVerticalX(
            preferredMidX,
            Math.min(startY, endY),
            Math.max(startY, endY),
            skipIds,
            MARGIN
          );
          points.push({ x: midX, y: startY });
          points.push({ x: midX, y: endY });
        }

        points.push({ x: endX, y: endY });
      } else {
        // TB: exit from bottom face, enter top face
        const srcFace = src.width;
        const tgtFace = tgt.width;
        const srcPort = nextOutPort(srcId, srcFace);
        const tgtPort = nextInPort(tgtId, tgtFace);

        const startX = Math.round(src.x + src.width / 2 + srcPort);
        const startY = Math.round(src.y + src.height);
        const endX = Math.round(tgt.x + tgt.width / 2 + tgtPort);
        const endY = Math.round(tgt.y);

        points.push({ x: startX, y: startY });

        if (startX !== endX) {
          const preferredMidY = Math.round((startY + endY) / 2);
          const midY = clearHorizontalY(
            preferredMidY,
            Math.min(startX, endX),
            Math.max(startX, endX),
            skipIds,
            MARGIN
          );
          points.push({ x: startX, y: midY });
          points.push({ x: endX, y: midY });
        }

        points.push({ x: endX, y: endY });
      }
    }

    // Remove consecutive duplicate points
    const cleaned: { x: number; y: number }[] = [];
    for (const pt of points) {
      if (
        cleaned.length === 0 ||
        cleaned[cleaned.length - 1].x !== pt.x ||
        cleaned[cleaned.length - 1].y !== pt.y
      ) {
        cleaned.push(pt);
      }
    }

    result[`e${index}`] = { points: cleaned };
  });

  return result;
}
