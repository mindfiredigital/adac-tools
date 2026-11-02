import type {
  EdgeData,
  EdgePath,
  LayoutOptions,
  LayoutResult,
  NodeData,
  NodePosition,
} from './types';
import { Graph } from './graph/graph';
import { detectCycles, breakCycles } from './algorithms/cycle-detection';
import { assignRanks, normalize } from './algorithms/rank-assignment';
import { orderNodes } from './algorithms/node-ordering';
import { assignCoordinates } from './algorithms/coordinate-assignment';

type Point = { x: number; y: number };

type StoredNode = {
  id: string;
  width: number;
  height: number;
  data: NodeData;
};

type StoredEdge = {
  id: string;
  from: string;
  to: string;
  data?: EdgeData;
};

type RouteBox = {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  cy: number;
};

const DEFAULT_NODE_WIDTH = 96;
const DEFAULT_NODE_HEIGHT = 116;
const DEFAULT_NODE_SEP = 120;
const DEFAULT_RANK_SEP = 120;
const DEFAULT_MARGIN_X = 48;
const DEFAULT_MARGIN_Y = 48;
const DEFAULT_EDGE_MARGIN = 28;
const GRID_UNIT = 10;
const DEFAULT_TRACK_ATTEMPTS = 10;

/**
 * Opt-in Topology-Shape-Metrics inspired orthogonal layout engine.
 *
 * Node placement reuses the same layered-graph pipeline as
 * `CustomLayoutEngine` (cycle breaking, rank assignment, crossing-minimizing
 * ordering, Brandes-Koepf-style coordinate assignment) so that `rankdir`
 * ('LR' or 'TB') produces a real flow-direction layout instead of an
 * unordered grid. Edge drawing keeps this engine's own orthogonalization
 * phase: global side/track assignment with Manhattan paths and obstacle
 * avoidance, which is what gives architecture diagrams clean right-angle
 * connectors.
 */
export class OrthogonalLayoutEngine {
  private readonly nodes = new Map<string, StoredNode>();
  private readonly edges: StoredEdge[] = [];
  private edgeSequence = 0;

  constructor(private readonly options: LayoutOptions = {}) {}

  addNode(id: string, data: NodeData): void {
    this.nodes.set(id, {
      id,
      width: sanitizeDimension(data.width, DEFAULT_NODE_WIDTH),
      height: sanitizeDimension(data.height, DEFAULT_NODE_HEIGHT),
      data,
    });
  }

  addEdge(from: string, to: string, data?: EdgeData): void {
    const id = String(data?.id ?? `__edge${this.edgeSequence++}`);
    this.edges.push({
      id,
      from,
      to,
      data,
    });
  }

  layout(): LayoutResult {
    const { positions, order } = this.assignPositions();

    // Route edges in "least conflicting first" order so later routing can
    // reserve longer detours for edges that would cross more. Distance is
    // measured in the final flow order rather than raw declaration order,
    // so short/local edges are no longer routed after long cross-diagram
    // ones purely by accident of declaration order.
    const positionIndex = new Map(order.map((id, index) => [id, index]));
    const knownEdges = this.edges.filter(
      (edge) => this.nodes.has(edge.from) && this.nodes.has(edge.to)
    );
    const orderedEdges = sortByStableKey(knownEdges, (edge) => {
      const fromIndex = positionIndex.get(edge.from) ?? 0;
      const toIndex = positionIndex.get(edge.to) ?? 0;
      return [Math.abs(fromIndex - toIndex), fromIndex, toIndex, edge.id];
    });

    const edges = this.orthogonalize(orderedEdges, positions);
    const bounds = calculateBounds(positions, edges, this.options);

    return { nodes: positions, edges, bounds };
  }

  /**
   * Node placement: reuses the layered-graph pipeline (cycle breaking, rank
   * assignment, crossing-minimizing ordering, coordinate assignment) so
   * `rankdir` produces a genuine flow-direction layout — the same building
   * blocks `CustomLayoutEngine` uses — instead of a degree-sorted grid.
   */
  private assignPositions(): {
    positions: Record<string, NodePosition>;
    order: string[];
  } {
    if (this.nodes.size === 0) return { positions: {}, order: [] };

    const graph = new Graph();
    for (const node of this.nodes.values()) {
      graph.addNode(node.id, { width: node.width, height: node.height });
    }
    for (const edge of this.edges) {
      if (edge.from === edge.to) continue; // self-loops don't affect ranking
      if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) continue;
      graph.addEdge(edge.from, edge.to);
    }

    const options = {
      rankdir: this.options.rankdir ?? 'TB',
      nodesep: this.options.nodesep ?? DEFAULT_NODE_SEP,
      ranksep: this.options.ranksep ?? DEFAULT_RANK_SEP,
      marginx: this.options.marginx ?? DEFAULT_MARGIN_X,
      marginy: this.options.marginy ?? DEFAULT_MARGIN_Y,
      edgeMargin: this.options.edgeMargin ?? DEFAULT_EDGE_MARGIN,
      edgeRoutingMaxAttempts: this.options.edgeRoutingMaxAttempts ?? 20,
      logger: this.options.logger ?? { warn: () => {} },
      maxIterations: this.options.maxIterations ?? 48,
      nodePlacementStrategy:
        this.options.nodePlacementStrategy ?? 'BRANDES_KOEPF',
    };

    const cycles = detectCycles(graph);
    if (cycles.length > 0) breakCycles(graph, cycles);

    assignRanks(graph);

    // A node with exactly one real connection (e.g. a KMS key or an IAM
    // role that only ever feeds into one bucket) is a pure satellite: it
    // has no other relationships pulling on it, so assignRanks' generic
    // "balance between earliest and latest possible layer" heuristic can
    // leave it stranded many ranks away from the one thing it actually
    // connects to — that's what was producing long, multi-bend detour
    // edges back to its real target. Pull it flush against that neighbor's
    // rank instead, same side as the edge direction, before normalize()
    // turns any remaining gap into a chain of bend-point virtual nodes.
    graph.nodes.forEach((node) => {
      const degree = node.incoming.size + node.outgoing.size;
      if (degree !== 1) return;
      const isSource = node.outgoing.size === 1;
      const neighborId = (isSource ? node.outgoing : node.incoming)
        .values()
        .next().value;
      const neighbor = neighborId ? graph.getNode(neighborId) : undefined;
      if (!neighbor) return;
      node.rank = isSource ? Math.max(0, neighbor.rank - 1) : neighbor.rank + 1;
    });

    normalize(graph);

    const ranks = new Map<string, number>();
    graph.nodes.forEach((node, id) => ranks.set(id, node.rank));

    const ordering = orderNodes(graph, ranks, options);
    const rawPositions = assignCoordinates(graph, ranks, ordering, options);

    // Drop virtual (edge-bend) nodes introduced by normalize(); this engine's
    // own orthogonalize() phase computes real edge geometry separately.
    // Snap to the same 10-unit grid as edge routing so node box edges land
    // exactly on the coordinates ports/paths are snapped to.
    const positions: Record<string, NodePosition> = {};
    for (const id of this.nodes.keys()) {
      const raw = rawPositions[id];
      if (raw) positions[id] = { ...raw, x: snap(raw.x), y: snap(raw.y) };
    }

    const order: string[] = [];
    Array.from(ordering.keys())
      .sort((a, b) => a - b)
      .forEach((rank) => {
        (ordering.get(rank) || []).forEach((id) => {
          if (this.nodes.has(id)) order.push(id);
        });
      });

    return { positions, order };
  }

  private orthogonalize(
    orderedEdges: StoredEdge[],
    nodes: Record<string, NodePosition>
  ): Record<string, EdgePath> {
    const edgePaths: Record<string, EdgePath> = {};
    const boxes = new Map<string, RouteBox>();

    for (const [id, node] of Object.entries(nodes)) {
      boxes.set(id, {
        id,
        left: node.x,
        right: node.x + node.width,
        top: node.y,
        bottom: node.y + node.height,
        cx: node.x + node.width / 2,
        cy: node.y + node.height / 2,
      });
    }

    const verticalTracks = new TrackAllocator();
    const horizontalTracks = new TrackAllocator();
    const edgeMargin = this.options.edgeMargin ?? DEFAULT_EDGE_MARGIN;

    for (const edge of orderedEdges) {
      const source = boxes.get(edge.from);
      const target = boxes.get(edge.to);
      if (!source || !target) continue;

      const path =
        source.id === target.id
          ? routeSelfLoop(source, horizontalTracks, edgeMargin)
          : routeBetweenBoxes(
              source,
              target,
              boxes,
              verticalTracks,
              horizontalTracks,
              edgeMargin
            );

      edgePaths[edge.id] = { points: simplifyPath(path.map(snapPoint)) };
    }

    return edgePaths;
  }
}

class TrackAllocator {
  private readonly used = new Map<number, number>();

  reserve(preferred: number, minimumGap: number): number {
    const key = snap(Math.max(minimumGap, preferred));
    const count = this.used.get(key) ?? 0;
    this.used.set(key, count + 1);
    if (count === 0) return key;

    const direction = count % 2 === 0 ? -1 : 1;
    const distance = Math.ceil(count / 2) * minimumGap;
    return snap(Math.max(minimumGap, key + direction * distance));
  }

  reserveClear(
    candidates: number[],
    minimumGap: number,
    isClear: (track: number) => boolean
  ): number | undefined {
    for (const candidate of candidates) {
      const key = snap(Math.max(minimumGap, candidate));
      const count = this.used.get(key) ?? 0;

      for (const offset of trackOffsets(count, minimumGap)) {
        const track = snap(Math.max(minimumGap, key + offset));
        if (!isClear(track)) continue;

        this.used.set(key, count + 1);
        return track;
      }
    }

    return undefined;
  }
}

function routeBetweenBoxes(
  source: RouteBox,
  target: RouteBox,
  boxes: Map<string, RouteBox>,
  verticalTracks: TrackAllocator,
  horizontalTracks: TrackAllocator,
  edgeMargin: number
): Point[] {
  const dx = target.cx - source.cx;
  const dy = target.cy - source.cy;
  const preferHorizontal = Math.abs(dx) >= Math.abs(dy);

  if (preferHorizontal) {
    const start = dx >= 0 ? rightPort(source) : leftPort(source);
    const end = dx >= 0 ? leftPort(target) : rightPort(target);
    const rawTrack = (start.x + end.x) / 2;
    const verticalCandidates = clearVerticalTrackCandidates(
      rawTrack,
      source,
      target,
      boxes,
      edgeMargin
    );
    const verticalTrack = verticalTracks.reserveClear(
      verticalCandidates,
      edgeMargin,
      (track) =>
        isPathClear(
          [start, { x: track, y: start.y }, { x: track, y: end.y }, end],
          source,
          target,
          boxes,
          edgeMargin
        )
    );

    if (verticalTrack !== undefined) {
      return [
        start,
        { x: verticalTrack, y: start.y },
        { x: verticalTrack, y: end.y },
        end,
      ];
    }

    const startDirection = dx >= 0 ? 1 : -1;
    const endDirection = dx >= 0 ? -1 : 1;
    const horizontalCandidates = clearHorizontalTrackCandidates(
      (start.y + end.y) / 2,
      source,
      target,
      boxes,
      edgeMargin
    );
    const horizontalTrack = horizontalTracks.reserveClear(
      horizontalCandidates,
      edgeMargin,
      (track) =>
        isPathClear(
          buildHorizontalDetour(
            start,
            end,
            startDirection,
            endDirection,
            track,
            edgeMargin
          ),
          source,
          target,
          boxes,
          edgeMargin
        )
    );

    if (horizontalTrack !== undefined) {
      return buildHorizontalDetour(
        start,
        end,
        startDirection,
        endDirection,
        horizontalTrack,
        edgeMargin
      );
    }

    return shortestPathByCollisions(
      [
        ...verticalCandidates.map((track) => [
          start,
          { x: track, y: start.y },
          { x: track, y: end.y },
          end,
        ]),
        ...horizontalCandidates.map((track) =>
          buildHorizontalDetour(
            start,
            end,
            startDirection,
            endDirection,
            track,
            edgeMargin
          )
        ),
      ],
      source,
      target,
      boxes,
      edgeMargin
    );
  }

  const start = dy >= 0 ? bottomPort(source) : topPort(source);
  const end = dy >= 0 ? topPort(target) : bottomPort(target);
  const rawTrack = (start.y + end.y) / 2;
  const horizontalCandidates = clearHorizontalTrackCandidates(
    rawTrack,
    source,
    target,
    boxes,
    edgeMargin
  );
  const horizontalTrack = horizontalTracks.reserveClear(
    horizontalCandidates,
    edgeMargin,
    (track) =>
      isPathClear(
        [start, { x: start.x, y: track }, { x: end.x, y: track }, end],
        source,
        target,
        boxes,
        edgeMargin
      )
  );

  if (horizontalTrack !== undefined) {
    return [
      start,
      { x: start.x, y: horizontalTrack },
      { x: end.x, y: horizontalTrack },
      end,
    ];
  }

  const startDirection = dy >= 0 ? 1 : -1;
  const endDirection = dy >= 0 ? -1 : 1;
  const verticalCandidates = clearVerticalTrackCandidates(
    (start.x + end.x) / 2,
    source,
    target,
    boxes,
    edgeMargin
  );
  const verticalTrack = verticalTracks.reserveClear(
    verticalCandidates,
    edgeMargin,
    (track) =>
      isPathClear(
        buildVerticalDetour(
          start,
          end,
          startDirection,
          endDirection,
          track,
          edgeMargin
        ),
        source,
        target,
        boxes,
        edgeMargin
      )
  );

  if (verticalTrack !== undefined) {
    return buildVerticalDetour(
      start,
      end,
      startDirection,
      endDirection,
      verticalTrack,
      edgeMargin
    );
  }

  return shortestPathByCollisions(
    [
      ...horizontalCandidates.map((track) => [
        start,
        { x: start.x, y: track },
        { x: end.x, y: track },
        end,
      ]),
      ...verticalCandidates.map((track) =>
        buildVerticalDetour(
          start,
          end,
          startDirection,
          endDirection,
          track,
          edgeMargin
        )
      ),
    ],
    source,
    target,
    boxes,
    edgeMargin
  );
}

function routeSelfLoop(
  box: RouteBox,
  horizontalTracks: TrackAllocator,
  edgeMargin: number
): Point[] {
  const start = rightPort(box);
  const end = bottomPort(box);
  const outsideX = snap(box.right + edgeMargin);
  const outsideY = horizontalTracks.reserve(
    box.bottom + edgeMargin,
    edgeMargin
  );

  return [
    start,
    { x: outsideX, y: start.y },
    { x: outsideX, y: outsideY },
    { x: end.x, y: outsideY },
    end,
  ];
}

function clearVerticalTrackCandidates(
  preferred: number,
  source: RouteBox,
  target: RouteBox,
  boxes: Map<string, RouteBox>,
  edgeMargin: number
): number[] {
  const minY = Math.min(source.cy, target.cy);
  const maxY = Math.max(source.cy, target.cy);
  const candidates = [preferred];

  for (const box of boxes.values()) {
    if (box.id === source.id || box.id === target.id) continue;
    const overlapsY =
      box.top - edgeMargin <= maxY && box.bottom + edgeMargin >= minY;
    const hitsX =
      preferred >= box.left - edgeMargin && preferred <= box.right + edgeMargin;
    if (overlapsY && hitsX) {
      candidates.push(box.left - edgeMargin, box.right + edgeMargin);
    }
  }

  const bounds = routeBounds(boxes, edgeMargin);
  candidates.push(bounds.left, bounds.right);

  return sortTracksByPreference(candidates, preferred);
}

function clearHorizontalTrackCandidates(
  preferred: number,
  source: RouteBox,
  target: RouteBox,
  boxes: Map<string, RouteBox>,
  edgeMargin: number
): number[] {
  const minX = Math.min(source.cx, target.cx);
  const maxX = Math.max(source.cx, target.cx);
  const candidates = [preferred];

  for (const box of boxes.values()) {
    if (box.id === source.id || box.id === target.id) continue;
    const overlapsX =
      box.left - edgeMargin <= maxX && box.right + edgeMargin >= minX;
    const hitsY =
      preferred >= box.top - edgeMargin && preferred <= box.bottom + edgeMargin;
    if (overlapsX && hitsY) {
      candidates.push(box.top - edgeMargin, box.bottom + edgeMargin);
    }
  }

  const bounds = routeBounds(boxes, edgeMargin);
  candidates.push(bounds.top, bounds.bottom);

  return sortTracksByPreference(candidates, preferred);
}

function buildHorizontalDetour(
  start: Point,
  end: Point,
  startDirection: number,
  endDirection: number,
  track: number,
  edgeMargin: number
): Point[] {
  const startOutsideX = start.x + startDirection * edgeMargin;
  const endOutsideX = end.x + endDirection * edgeMargin;

  return [
    start,
    { x: startOutsideX, y: start.y },
    { x: startOutsideX, y: track },
    { x: endOutsideX, y: track },
    { x: endOutsideX, y: end.y },
    end,
  ];
}

function buildVerticalDetour(
  start: Point,
  end: Point,
  startDirection: number,
  endDirection: number,
  track: number,
  edgeMargin: number
): Point[] {
  const startOutsideY = start.y + startDirection * edgeMargin;
  const endOutsideY = end.y + endDirection * edgeMargin;

  return [
    start,
    { x: start.x, y: startOutsideY },
    { x: track, y: startOutsideY },
    { x: track, y: endOutsideY },
    { x: end.x, y: endOutsideY },
    end,
  ];
}

function isPathClear(
  path: Point[],
  source: RouteBox,
  target: RouteBox,
  boxes: Map<string, RouteBox>,
  edgeMargin: number
): boolean {
  return countPathCollisions(path, source, target, boxes, edgeMargin) === 0;
}

function countPathCollisions(
  path: Point[],
  source: RouteBox,
  target: RouteBox,
  boxes: Map<string, RouteBox>,
  edgeMargin: number
): number {
  let collisions = 0;

  for (let index = 0; index < path.length - 1; index++) {
    const from = path[index];
    const to = path[index + 1];
    for (const box of boxes.values()) {
      if (box.id === source.id || box.id === target.id) continue;
      if (segmentIntersectsBox(from, to, box, edgeMargin)) collisions++;
    }
  }

  return collisions;
}

function segmentIntersectsBox(
  from: Point,
  to: Point,
  box: RouteBox,
  edgeMargin: number
): boolean {
  const left = box.left - edgeMargin;
  const right = box.right + edgeMargin;
  const top = box.top - edgeMargin;
  const bottom = box.bottom + edgeMargin;

  if (from.x === to.x) {
    const lo = Math.min(from.y, to.y);
    const hi = Math.max(from.y, to.y);
    return from.x >= left && from.x <= right && hi >= top && lo <= bottom;
  }

  if (from.y === to.y) {
    const lo = Math.min(from.x, to.x);
    const hi = Math.max(from.x, to.x);
    return from.y >= top && from.y <= bottom && hi >= left && lo <= right;
  }

  return false;
}

function shortestPathByCollisions(
  paths: Point[][],
  source: RouteBox,
  target: RouteBox,
  boxes: Map<string, RouteBox>,
  edgeMargin: number
): Point[] {
  let best = paths[0];
  let bestCollisions = Number.POSITIVE_INFINITY;
  let bestLength = Number.POSITIVE_INFINITY;

  for (const path of paths) {
    const collisions = countPathCollisions(
      path,
      source,
      target,
      boxes,
      edgeMargin
    );
    const length = pathLength(path);
    if (
      collisions < bestCollisions ||
      (collisions === bestCollisions && length < bestLength)
    ) {
      best = path;
      bestCollisions = collisions;
      bestLength = length;
    }
  }

  return best;
}

function pathLength(path: Point[]): number {
  let length = 0;
  for (let index = 0; index < path.length - 1; index++) {
    length +=
      Math.abs(path[index].x - path[index + 1].x) +
      Math.abs(path[index].y - path[index + 1].y);
  }
  return length;
}

function routeBounds(
  boxes: Map<string, RouteBox>,
  edgeMargin: number
): { left: number; right: number; top: number; bottom: number } {
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const box of boxes.values()) {
    left = Math.min(left, box.left);
    right = Math.max(right, box.right);
    top = Math.min(top, box.top);
    bottom = Math.max(bottom, box.bottom);
  }

  return {
    left: Math.max(edgeMargin, left - edgeMargin),
    right: right + edgeMargin,
    top: Math.max(edgeMargin, top - edgeMargin),
    bottom: bottom + edgeMargin,
  };
}

function sortTracksByPreference(values: number[], preferred: number): number[] {
  return Array.from(new Set(values.map(snap))).sort((left, right) => {
    const distance = Math.abs(left - preferred) - Math.abs(right - preferred);
    return distance === 0 ? left - right : distance;
  });
}

function trackOffsets(
  startCount: number,
  minimumGap: number,
  attempts: number = DEFAULT_TRACK_ATTEMPTS
): number[] {
  const offsets: number[] = [];
  for (let index = 0; index < attempts; index++) {
    const count = startCount + index;
    if (count === 0) {
      offsets.push(0);
      continue;
    }

    const direction = count % 2 === 0 ? -1 : 1;
    offsets.push(direction * Math.ceil(count / 2) * minimumGap);
  }
  return offsets;
}

function leftPort(box: RouteBox): Point {
  return { x: box.left, y: box.cy };
}

function rightPort(box: RouteBox): Point {
  return { x: box.right, y: box.cy };
}

function topPort(box: RouteBox): Point {
  return { x: box.cx, y: box.top };
}

function bottomPort(box: RouteBox): Point {
  return { x: box.cx, y: box.bottom };
}

function simplifyPath(points: Point[]): Point[] {
  const deduped = points.filter((point, index) => {
    const prev = points[index - 1];
    return !prev || prev.x !== point.x || prev.y !== point.y;
  });

  return deduped.filter((point, index) => {
    const prev = deduped[index - 1];
    const next = deduped[index + 1];
    if (!prev || !next) return true;
    const sameVertical = prev.x === point.x && point.x === next.x;
    const sameHorizontal = prev.y === point.y && point.y === next.y;
    return !sameVertical && !sameHorizontal;
  });
}

function calculateBounds(
  nodes: Record<string, NodePosition>,
  edges: Record<string, EdgePath>,
  options: LayoutOptions
) {
  let maxX = 0;
  let maxY = 0;
  const marginX = options.marginx ?? DEFAULT_MARGIN_X;
  const marginY = options.marginy ?? DEFAULT_MARGIN_Y;

  for (const node of Object.values(nodes)) {
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  for (const edge of Object.values(edges)) {
    for (const point of edge.points) {
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  return {
    width: snap(maxX + marginX),
    height: snap(maxY + marginY),
  };
}

function sanitizeDimension(
  value: number | undefined,
  fallback: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function sortByStableKey<T>(
  values: T[],
  getKey: (value: T) => string | number | Array<string | number>
): T[] {
  return [...values].sort((a, b) => compareKeys(getKey(a), getKey(b)));
}

function compareKeys(
  left: string | number | Array<string | number>,
  right: string | number | Array<string | number>
): number {
  const leftParts = Array.isArray(left) ? left : [left];
  const rightParts = Array.isArray(right) ? right : [right];
  const length = Math.max(leftParts.length, rightParts.length);

  for (let i = 0; i < length; i++) {
    const leftValue = leftParts[i] ?? '';
    const rightValue = rightParts[i] ?? '';
    if (leftValue < rightValue) return -1;
    if (leftValue > rightValue) return 1;
  }

  return 0;
}

function snapPoint(point: Point): Point {
  return { x: snap(point.x), y: snap(point.y) };
}

function snap(value: number): number {
  return Math.round(value / GRID_UNIT) * GRID_UNIT;
}
