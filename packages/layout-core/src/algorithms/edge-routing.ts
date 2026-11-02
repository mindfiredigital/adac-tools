import { Graph } from '../graph/graph';
import { NodePosition, EdgePath, LayoutOptions } from '../types';

const PARALLEL_JITTER_GROUP = 5;
const PARALLEL_JITTER_OFFSET = 2;
const PARALLEL_JITTER_STEP = 8;
const COLLISION_REROUTE_PASSES = 4;

/**
 * Production-grade orthogonal edge router with:
 * - Port distribution across node faces
 * - Full node-avoidance with iterative nudging
 * - Channel routing between ranks for long-span edges
 * - Shared segment merging to reduce visual clutter
 */
export function routeEdges(
  graph: Graph,
  positions: Record<string, NodePosition>,
  options: Required<LayoutOptions>
): Record<string, EdgePath> {
  const result: Record<string, EdgePath> = {};
  const isHorizontal = options.rankdir === 'LR';
  const MARGIN = Math.max(options.edgeMargin, 16);
  const maxRoutingAttempts = Number.isFinite(options.edgeRoutingMaxAttempts)
    ? Math.max(1, Math.floor(options.edgeRoutingMaxAttempts))
    : 20;
  const parallelJitter = (edgeIndex: number) =>
    ((edgeIndex % PARALLEL_JITTER_GROUP) - PARALLEL_JITTER_OFFSET) *
    PARALLEL_JITTER_STEP;

  // ── Build spatial index of real node bounding boxes ──
  const boxes: {
    id: string;
    x: number;
    y: number;
    r: number;
    b: number;
  }[] = [];
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

  // ── Smart Spatial Port Allocation ──
  const edgeOutPort = new Map<number, number>();
  const edgeInPort = new Map<number, number>();

  const outEdges = new Map<
    string,
    { edgeIndex: number; targetCoord: number }[]
  >();
  const inEdges = new Map<
    string,
    { edgeIndex: number; sourceCoord: number }[]
  >();

  graph.edges.forEach((edge, index) => {
    const path = edge.virtualPath || [edge.from, edge.to];
    const srcId = path[0];
    const firstTarget = path[1];
    const tgtId = path[path.length - 1];
    const lastSource = path[path.length - 2];

    const srcNode = graph.getNode(srcId);
    const firstTgtNodePos = positions[firstTarget];
    if (srcNode && firstTgtNodePos) {
      const outList = outEdges.get(srcId) || [];
      const targetCoord = isHorizontal ? firstTgtNodePos.y : firstTgtNodePos.x;
      outList.push({ edgeIndex: index, targetCoord });
      outEdges.set(srcId, outList);
    }

    const tgtNode = graph.getNode(tgtId);
    const lastSrcNodePos = positions[lastSource];
    if (tgtNode && lastSrcNodePos) {
      const inList = inEdges.get(tgtId) || [];
      const sourceCoord = isHorizontal ? lastSrcNodePos.y : lastSrcNodePos.x;
      inList.push({ edgeIndex: index, sourceCoord });
      inEdges.set(tgtId, inList);
    }
  });

  outEdges.forEach((list, nodeId) => {
    const node = graph.getNode(nodeId);
    if (!node) return;
    list.sort((a, b) => a.targetCoord - b.targetCoord);
    const faceLength = isHorizontal ? node.height : node.width;
    const padding = Math.min(faceLength * 0.15, 12);
    const usable = faceLength - 2 * padding;
    list.forEach((item, idx) => {
      const offset =
        list.length <= 1
          ? 0
          : padding + idx * (usable / (list.length - 1)) - faceLength / 2;
      edgeOutPort.set(item.edgeIndex, offset);
    });
  });

  inEdges.forEach((list, nodeId) => {
    const node = graph.getNode(nodeId);
    if (!node) return;
    list.sort((a, b) => a.sourceCoord - b.sourceCoord);
    const faceLength = isHorizontal ? node.height : node.width;
    const padding = Math.min(faceLength * 0.15, 12);
    const usable = faceLength - 2 * padding;
    list.forEach((item, idx) => {
      const offset =
        list.length <= 1
          ? 0
          : padding + idx * (usable / (list.length - 1)) - faceLength / 2;
      edgeInPort.set(item.edgeIndex, offset);
    });
  });

  function allocateOutPort(edgeIndex: number): number {
    return edgeOutPort.get(edgeIndex) || 0;
  }

  function allocateInPort(edgeIndex: number): number {
    return edgeInPort.get(edgeIndex) || 0;
  }

  // ── Collision detection helpers ──
  function hitsHorizontalSegment(
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

  function hitsVerticalSegment(
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
   * Find a clear horizontal Y channel between x1 and x2 that doesn't
   * overlap any node. Tries progressively further offsets.
   */
  function findClearHorizontalY(
    preferredY: number,
    x1: number,
    x2: number,
    skipIds: Set<string>,
    margin: number
  ): number {
    let y = preferredY;
    for (let attempt = 0; attempt < maxRoutingAttempts; attempt++) {
      const hit = hitsHorizontalSegment(y, x1, x2, skipIds, margin);
      if (!hit) return y;

      // Try going above or below the hit box
      const aboveY = hit.y - margin - 1;
      const belowY = hit.b + margin + 1;

      // Choose whichever is closer to preferred
      if (Math.abs(preferredY - aboveY) <= Math.abs(preferredY - belowY)) {
        y = aboveY;
      } else {
        y = belowY;
      }
    }
    options.logger?.warn(
      `Edge routing reached ${maxRoutingAttempts} horizontal channel-search attempts.`
    );
    return y;
  }

  /**
   * Find a clear vertical X channel between y1 and y2.
   */
  function findClearVerticalX(
    preferredX: number,
    y1: number,
    y2: number,
    skipIds: Set<string>,
    margin: number
  ): number {
    let x = preferredX;
    for (let attempt = 0; attempt < maxRoutingAttempts; attempt++) {
      const hit = hitsVerticalSegment(x, y1, y2, skipIds, margin);
      if (!hit) return x;

      const leftX = hit.x - margin - 1;
      const rightX = hit.r + margin + 1;

      if (Math.abs(preferredX - leftX) <= Math.abs(preferredX - rightX)) {
        x = leftX;
      } else {
        x = rightX;
      }
    }
    options.logger?.warn(
      `Edge routing reached ${maxRoutingAttempts} vertical channel-search attempts.`
    );
    return x;
  }

  /**
   * Route a direct edge between two adjacent-rank nodes using
   * orthogonal segments with collision avoidance.
   */
  function routeDirectEdge(
    srcId: string,
    tgtId: string,
    skipIds: Set<string>,
    edgeIndex: number
  ): { x: number; y: number }[] {
    const src = graph.getNode(srcId);
    const tgt = graph.getNode(tgtId);
    const points: { x: number; y: number }[] = [];
    if (!src || !tgt) return points;

    if (isHorizontal) {
      const isReversed = src.rank > tgt.rank;
      const srcPort = allocateOutPort(edgeIndex);
      const tgtPort = allocateInPort(edgeIndex);

      const startX = isReversed
        ? Math.round(src.x)
        : Math.round(src.x + src.width);
      const startY = Math.round(src.y + src.height / 2 + srcPort);
      const endX = isReversed
        ? Math.round(tgt.x + tgt.width)
        : Math.round(tgt.x);
      const endY = Math.round(tgt.y + tgt.height / 2 + tgtPort);

      points.push({ x: startX, y: startY });

      if (startY !== endY) {
        // Jitter midX by edgeIndex to separate parallel edges
        const preferredMidX =
          Math.round((startX + endX) / 2) + parallelJitter(edgeIndex);
        const midX = findClearVerticalX(
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
      const isReversed = src.rank > tgt.rank;
      const srcPort = allocateOutPort(edgeIndex);
      const tgtPort = allocateInPort(edgeIndex);

      const startX = Math.round(src.x + src.width / 2 + srcPort);
      const startY = isReversed
        ? Math.round(src.y)
        : Math.round(src.y + src.height);
      const endX = Math.round(tgt.x + tgt.width / 2 + tgtPort);
      const endY = isReversed
        ? Math.round(tgt.y + tgt.height)
        : Math.round(tgt.y);

      points.push({ x: startX, y: startY });

      if (startX !== endX) {
        // Jitter midY by edgeIndex to separate parallel edges
        const preferredMidY =
          Math.round((startY + endY) / 2) + parallelJitter(edgeIndex);
        const midY = findClearHorizontalY(
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

    return points;
  }

  /**
   * Route a long-span edge that passes through virtual nodes.
   * Uses virtual node positions as waypoints but routes orthogonally
   * with collision avoidance between each segment.
   */
  function routeVirtualPathEdge(
    path: string[],
    skipIds: Set<string>,
    edgeIndex: number
  ): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    const srcNode = graph.getNode(path[0]);
    const tgtNode = graph.getNode(path[path.length - 1]);
    if (!srcNode || !tgtNode) return points;
    const isReversed = srcNode.rank > tgtNode.rank;
    const srcPort = allocateOutPort(edgeIndex);
    const tgtPort = allocateInPort(edgeIndex);

    for (let i = 0; i < path.length; i++) {
      const nodeId = path[i];
      const node = graph.getNode(nodeId);
      if (!node) continue;

      if (i === 0) {
        // Start at source exit face
        if (isHorizontal) {
          points.push({
            x: isReversed
              ? Math.round(node.x)
              : Math.round(node.x + node.width),
            y: Math.round(node.y + node.height / 2 + srcPort),
          });
        } else {
          points.push({
            x: Math.round(node.x + node.width / 2 + srcPort),
            y: isReversed
              ? Math.round(node.y)
              : Math.round(node.y + node.height),
          });
        }
      } else if (i === path.length - 1) {
        // End at target entry face
        const prev = points[points.length - 1];

        if (isHorizontal) {
          const endX = isReversed
            ? Math.round(node.x + node.width)
            : Math.round(node.x);
          const endY = Math.round(node.y + node.height / 2 + tgtPort);

          // Add orthogonal routing if needed
          if (prev.y !== endY) {
            const midX = findClearVerticalX(
              Math.round((prev.x + endX) / 2),
              Math.min(prev.y, endY),
              Math.max(prev.y, endY),
              skipIds,
              MARGIN
            );
            points.push({ x: midX, y: prev.y });
            points.push({ x: midX, y: endY });
          }
          points.push({ x: endX, y: endY });
        } else {
          const endX = Math.round(node.x + node.width / 2 + tgtPort);
          const endY = isReversed
            ? Math.round(node.y + node.height)
            : Math.round(node.y);

          if (prev.x !== endX) {
            const midY = findClearHorizontalY(
              Math.round((prev.y + endY) / 2),
              Math.min(prev.x, endX),
              Math.max(prev.x, endX),
              skipIds,
              MARGIN
            );
            points.push({ x: prev.x, y: midY });
            points.push({ x: endX, y: midY });
          }
          points.push({ x: endX, y: endY });
        }
      } else {
        // Virtual node — route through its position orthogonally
        const prev = points[points.length - 1];
        const vx = Math.round(node.x);
        const vy = Math.round(node.y);

        if (isHorizontal) {
          // Route horizontally to virtual node X, then vertically to its Y
          if (prev.y !== vy) {
            const midX = findClearVerticalX(
              Math.round((prev.x + vx) / 2),
              Math.min(prev.y, vy),
              Math.max(prev.y, vy),
              skipIds,
              MARGIN
            );
            points.push({ x: midX, y: prev.y });
            points.push({ x: midX, y: vy });
          }
          points.push({ x: vx, y: vy });
        } else {
          if (prev.x !== vx) {
            const midY = findClearHorizontalY(
              Math.round((prev.y + vy) / 2),
              Math.min(prev.x, vx),
              Math.max(prev.x, vx),
              skipIds,
              MARGIN
            );
            points.push({ x: prev.x, y: midY });
            points.push({ x: vx, y: midY });
          }
          points.push({ x: vx, y: vy });
        }
      }
    }

    return points;
  }

  // ── Route all edges ──
  graph.edges.forEach((edge, index) => {
    const path = edge.virtualPath || [edge.from, edge.to];
    const skipIds = new Set<string>([edge.from, edge.to]);

    let points: { x: number; y: number }[];

    if (path.length > 2) {
      points = routeVirtualPathEdge(path, skipIds, index);
    } else {
      points = routeDirectEdge(edge.from, edge.to, skipIds, index);
    }

    // ── Post-process: remove redundant collinear points ──
    const cleaned = removeCollinearPoints(points);

    // ── Post-process: final collision check on all segments ──
    const finalPoints = avoidCollisionsOnPath(
      cleaned,
      skipIds,
      MARGIN,
      findClearHorizontalY,
      findClearVerticalX
    );

    result[`e${index}`] = { points: finalPoints };
  });

  return result;
}

/**
 * Remove points that are collinear (on the same horizontal or vertical line)
 * keeping only the endpoints of each straight segment.
 */
function removeCollinearPoints(
  points: { x: number; y: number }[]
): { x: number; y: number }[] {
  if (points.length <= 2) return points;

  const result: { x: number; y: number }[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Keep point if direction changes
    const sameX = prev.x === curr.x && curr.x === next.x;
    const sameY = prev.y === curr.y && curr.y === next.y;

    if (sameX || sameY) {
      // Collinear — skip (the next endpoint will capture the segment)
      continue;
    }
    result.push(curr);
  }

  result.push(points[points.length - 1]);

  // Remove consecutive duplicates
  const deduped: { x: number; y: number }[] = [];
  for (const pt of result) {
    if (
      deduped.length === 0 ||
      deduped[deduped.length - 1].x !== pt.x ||
      deduped[deduped.length - 1].y !== pt.y
    ) {
      deduped.push(pt);
    }
  }

  return deduped;
}

/**
 * Final pass: walk each segment of the path and if any segment passes through
 * a node, reroute it around the node.
 */
function avoidCollisionsOnPath(
  points: { x: number; y: number }[],
  skipIds: Set<string>,
  margin: number,
  findClearH: (
    y: number,
    x1: number,
    x2: number,
    skip: Set<string>,
    m: number
  ) => number,
  findClearV: (
    x: number,
    y1: number,
    y2: number,
    skip: Set<string>,
    m: number
  ) => number
): { x: number; y: number }[] {
  function avoidCollisionsOnce(path: { x: number; y: number }[]): {
    points: { x: number; y: number }[];
    changed: boolean;
  } {
    const result: { x: number; y: number }[] = [path[0]];
    let changed = false;

    for (let i = 1; i < path.length; i++) {
      const prev = result[result.length - 1];
      const curr = path[i];

      if (prev.x === curr.x) {
        // Vertical segment — check for collisions
        const x = findClearV(
          prev.x,
          Math.min(prev.y, curr.y),
          Math.max(prev.y, curr.y),
          skipIds,
          margin
        );
        if (x !== prev.x) {
          changed = true;
          result.push({ x, y: prev.y });
          result.push({ x, y: curr.y });
        }
      } else if (prev.y === curr.y) {
        // Horizontal segment — check for collisions
        const y = findClearH(
          prev.y,
          Math.min(prev.x, curr.x),
          Math.max(prev.x, curr.x),
          skipIds,
          margin
        );
        if (y !== prev.y) {
          changed = true;
          result.push({ x: prev.x, y });
          result.push({ x: curr.x, y });
        }
      }

      result.push(curr);
    }

    return { points: result, changed };
  }

  function dedupePoints(path: { x: number; y: number }[]) {
    // Final dedup
    const deduped: { x: number; y: number }[] = [];
    for (const pt of path) {
      if (
        deduped.length === 0 ||
        deduped[deduped.length - 1].x !== pt.x ||
        deduped[deduped.length - 1].y !== pt.y
      ) {
        deduped.push(pt);
      }
    }

    return deduped;
  }

  if (points.length < 2) return points;

  let current = dedupePoints(points);

  for (let pass = 0; pass < COLLISION_REROUTE_PASSES; pass++) {
    const { points: next, changed } = avoidCollisionsOnce(current);
    current = dedupePoints(next);
    if (!changed) break;
  }

  return current;
}
