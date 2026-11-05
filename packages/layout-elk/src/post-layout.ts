import type { ElkEdge, ElkEdgeSection, ElkNode } from './types.js';
import {
  DEFAULT_CONTAINER_BOX,
  isLayoutOnlyEdge,
  LAYOUT_LINE_TYPE,
} from './declarative-layout.js';

/**
 * Runs on the node tree returned by ELK. It realises the parts of the
 * declarative layout ELK cannot express itself:
 *
 *  - `align`   cross-axis placement of each item within its line
 *  - `justify` main-axis distribution of each line within the container
 *  - `maxSize` ceilings, which ELK's layered algorithm does not enforce
 *
 * Nodes are moved in their parent's coordinate frame (so descendants follow),
 * and every edge attached to a moved node is re-attached and re-routed.
 *
 * Returns human-readable warnings (e.g. a container larger than its maxSize).
 */
export function applyLayoutPostProcessing(layout: ElkNode): string[] {
  const warnings: string[] = [];
  const pre = absolutePositions(layout);

  let moved = false;
  walk(layout, (node) => {
    checkMaxSize(node, warnings);
  });
  walk(layout, (node) => {
    if (node.properties?.stackAxis && restack(node)) moved = true;
  });
  const arrangeAll = () =>
    walk(layout, (node) => {
      if (node.properties?.arrangement && arrange(node)) moved = true;
    });
  arrangeAll();
  // trimming shrinks boxes, so containers that hold them are arranged again
  if (tightenArranged(layout)) {
    moved = true;
    arrangeAll();
  }

  if (moved) fixEdges(layout, pre);
  routeDeferredEdges(layout);
  attachHintedSides(layout);
  distributeEdgeEnds(layout);
  avoidCrossedContainers(layout);
  separateParallelRuns(layout);
  return warnings;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

type Pt = { x: number; y: number };

function walk(node: ElkNode, fn: (n: ElkNode) => void): void {
  fn(node);
  node.children?.forEach((c) => walk(c, fn));
}

function absolutePositions(root: ElkNode): Map<string, Pt> {
  const map = new Map<string, Pt>();
  const visit = (n: ElkNode, ox: number, oy: number) => {
    const x = ox + (n.x ?? 0);
    const y = oy + (n.y ?? 0);
    map.set(n.id, { x, y });
    n.children?.forEach((c) => visit(c, x, y));
  };
  visit(root, 0, 0);
  return map;
}

function checkMaxSize(node: ElkNode, warnings: string[]): void {
  const max = node.properties?.maxSize;
  if (!max) return;
  if (max.width !== undefined && (node.width ?? 0) > max.width + 0.5) {
    warnings.push(
      `"${node.id}" is ${Math.round(node.width ?? 0)}px wide, wider than its maxSize.width (${max.width}px); its content does not fit`
    );
  }
  if (max.height !== undefined && (node.height ?? 0) > max.height + 0.5) {
    warnings.push(
      `"${node.id}" is ${Math.round(node.height ?? 0)}px tall, taller than its maxSize.height (${max.height}px); its content does not fit`
    );
  }
}

/**
 * ELK does not keep declaration order among siblings that share a layer, so
 * re-stack them (along the axis they are stacked on) in declared order.
 */
function restack(node: ElkNode): boolean {
  const horizontal = node.properties!.stackAxis === 'horizontal';
  const kids = node.children ?? [];
  if (kids.length < 2) return false;

  const pos = (k: ElkNode) => (horizontal ? k.x : k.y) ?? 0;
  const size = (k: ElkNode) => (horizontal ? k.width : k.height) ?? 0;

  const sorted = [...kids].sort((a, b) => pos(a) - pos(b));
  let gap = Number.POSITIVE_INFINITY;
  for (let i = 1; i < sorted.length; i++) {
    const g = pos(sorted[i]) - (pos(sorted[i - 1]) + size(sorted[i - 1]));
    if (g >= 0) gap = Math.min(gap, g);
  }
  if (!Number.isFinite(gap)) gap = 40;

  let cursor = pos(sorted[0]);
  let moved = false;
  for (const kid of kids) {
    if (Math.abs(pos(kid) - cursor) > 0.01) {
      if (horizontal) kid.x = cursor;
      else kid.y = cursor;
      moved = true;
    }
    cursor += size(kid) + gap;
  }
  return moved;
}

interface Item {
  node: ElkNode;
  /** Offset of the node's parent frame inside the container frame. */
  ox: number;
  oy: number;
}

/** Returns true when any node was moved. */
function arrange(container: ElkNode): boolean {
  const arrangement = container.properties!.arrangement!;
  const horizontal = arrangement.mainAxis === 'horizontal';
  const children = container.children ?? [];
  const groups = children.filter(
    (c) => c.properties?.type === LAYOUT_LINE_TYPE
  );

  const lines: Item[][] =
    groups.length > 0
      ? groups.map((g) =>
          (g.children ?? []).map((node) => ({
            node,
            ox: g.x ?? 0,
            oy: g.y ?? 0,
          }))
        )
      : [children.map((node) => ({ node, ox: 0, oy: 0 }))];

  const pad = arrangement.padding;
  const innerStart = horizontal ? pad.left : pad.top;
  const innerEnd =
    (horizontal ? container.width : container.height) !== undefined
      ? horizontal
        ? container.width! - pad.right
        : container.height! - pad.bottom
      : innerStart;

  const mainStart = (i: Item) =>
    (horizontal ? i.node.x : i.node.y)! + (horizontal ? i.ox : i.oy);
  const mainSize = (i: Item) =>
    (horizontal ? i.node.width : i.node.height) ?? 0;
  const crossStart = (i: Item) =>
    (horizontal ? i.node.y : i.node.x)! + (horizontal ? i.oy : i.ox);
  const crossSize = (i: Item) =>
    (horizontal ? i.node.height : i.node.width) ?? 0;
  const shiftMain = (i: Item, d: number) => {
    if (horizontal) i.node.x = (i.node.x ?? 0) + d;
    else i.node.y = (i.node.y ?? 0) + d;
  };
  const shiftCross = (i: Item, d: number) => {
    if (horizontal) i.node.y = (i.node.y ?? 0) + d;
    else i.node.x = (i.node.x ?? 0) + d;
  };

  // Across a row, a leaf node is centred on its icon rather than on its box,
  // which also holds the caption; containers are centred on their box.
  const centerOffset = (i: Item) =>
    horizontal && (i.node.children?.length ?? 0) === 0
      ? Math.min(ICON_BAND_TOP + ICON_BAND_HEIGHT / 2, crossSize(i) / 2)
      : crossSize(i) / 2;

  let moved = false;
  const move = (fn: () => void, d: number) => {
    if (Math.abs(d) > 0.01) {
      fn();
      moved = true;
    }
  };

  for (const line of lines) {
    if (line.length === 0) continue;

    // align: cross-axis placement within the band the line occupies
    if (arrangement.align) {
      let bandStart = Math.min(...line.map(crossStart));
      let bandEnd = Math.max(...line.map((i) => crossStart(i) + crossSize(i)));
      // A lone line aligns within the container's inner box, not just among
      // its own items, so a box wider than its content centres the content.
      const crossExtent = horizontal ? container.height : container.width;
      if (
        lines.length === 1 &&
        !arrangement.fitToItems &&
        crossExtent !== undefined
      ) {
        const from = horizontal ? pad.top : pad.left;
        const to = crossExtent - (horizontal ? pad.bottom : pad.right);
        if (to - from > bandEnd - bandStart) {
          bandStart = from;
          bandEnd = to;
        }
      }
      for (const item of line) {
        const target =
          arrangement.align === 'start'
            ? bandStart
            : arrangement.align === 'end'
              ? bandEnd - crossSize(item)
              : bandStart + (bandEnd - bandStart) / 2 - centerOffset(item);
        const d = target - crossStart(item);
        move(() => shiftCross(item, d), d);
      }
    }

    // justify: main-axis distribution inside the container's inner box
    if (arrangement.justify && arrangement.justify !== 'start') {
      const sorted = [...line].sort((a, b) => mainStart(a) - mainStart(b));
      const first = mainStart(sorted[0]);
      const span =
        Math.max(...sorted.map((i) => mainStart(i) + mainSize(i))) - first;
      const slack = innerEnd - innerStart - span;
      if (slack > 0.01) {
        const base = innerStart - first;
        const n = sorted.length;
        sorted.forEach((item, idx) => {
          let d = base;
          switch (arrangement.justify) {
            case 'center':
              d += slack / 2;
              break;
            case 'end':
              d += slack;
              break;
            case 'space-between':
              d += n > 1 ? (slack / (n - 1)) * idx : slack / 2;
              break;
            case 'space-around':
              d += (slack / n) * (idx + 0.5);
              break;
          }
          move(() => shiftMain(item, d), d);
        });
      }
    }
  }
  return moved;
}

/**
 * Re-attaches edges to nodes that were moved, working in the edge's own
 * container frame. Edges whose two ends moved together are translated; edges
 * whose ends moved apart are re-routed with a single orthogonal Z.
 */
function fixEdges(root: ElkNode, pre: Map<string, Pt>): void {
  const post = absolutePositions(root);
  const delta = (id: string | undefined): Pt => {
    const a = id ? pre.get(id) : undefined;
    const b = id ? post.get(id) : undefined;
    return a && b ? { x: b.x - a.x, y: b.y - a.y } : { x: 0, y: 0 };
  };

  const ownerOf = new Map<string, string>();
  walk(root, (n) => {
    n.ports?.forEach((p) => ownerOf.set(p.id, n.id));
  });
  const owner = (ref: string | undefined) =>
    ref ? (ownerOf.get(ref) ?? ref) : undefined;

  walk(root, (n) => {
    (n.edges ?? []).forEach((edge: ElkEdge) => {
      const frame = edge.container ?? n.id;
      const dFrame = delta(frame);
      const ds = delta(owner(edge.sources?.[0]));
      const dt = delta(owner(edge.targets?.[0]));
      const together = ds.x === dt.x && ds.y === dt.y;
      if (together && ds.x === dFrame.x && ds.y === dFrame.y) return;

      const toFrame = (p: Pt, d: Pt): Pt => ({
        x: p.x + d.x - dFrame.x,
        y: p.y + d.y - dFrame.y,
      });

      edge.sections?.forEach((section) => {
        const start = toFrame(section.startPoint, ds);
        const end = toFrame(section.endPoint, dt);
        if (together) {
          section.bendPoints = section.bendPoints?.map((b) => toFrame(b, ds));
        } else {
          const firstTarget = section.bendPoints?.[0] ?? section.endPoint;
          const horizontalFirst =
            Math.abs(firstTarget.x - section.startPoint.x) >=
            Math.abs(firstTarget.y - section.startPoint.y);
          section.bendPoints = horizontalFirst
            ? zRoute(start, end, true)
            : zRoute(start, end, false);
        }
        section.startPoint = start;
        section.endPoint = end;
      });
    });
  });
}

/**
 * Sets `axis` of the end point `pts[i]` to `value` and carries along the run of
 * corners behind it that lay on the same line (ELK often leaves a collinear
 * point there), so the segment that joins the run to the rest of the route
 * stays perpendicular. The far end of the route (`pts[0]` / `pts[last]`) is
 * never part of the run.
 */
function shiftEndRun(
  pts: Pt[],
  i: number,
  axis: 'x' | 'y',
  value: number
): void {
  const old = pts[i][axis];
  const step = i === 0 ? 1 : -1;
  pts[i][axis] = value;
  for (
    let j = i + step;
    j > 0 && j < pts.length - 1 && Math.abs(pts[j][axis] - old) < 0.75;
    j += step
  ) {
    pts[j][axis] = value;
  }
}

function zRoute(start: Pt, end: Pt, horizontalFirst: boolean): Pt[] {
  if (horizontalFirst) {
    if (start.y === end.y) return [];
    const mx = (start.x + end.x) / 2;
    return [
      { x: mx, y: start.y },
      { x: mx, y: end.y },
    ];
  }
  if (start.x === end.x) return [];
  const my = (start.y + end.y) / 2;
  return [
    { x: start.x, y: my },
    { x: end.x, y: my },
  ];
}

// ── Deferred edges ──────────────────────────────────────────────────────────

const SIDE_VECTOR: Record<string, Pt> = {
  WEST: { x: -1, y: 0 },
  EAST: { x: 1, y: 0 },
  NORTH: { x: 0, y: -1 },
  SOUTH: { x: 0, y: 1 },
};

interface AbsBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Route between two boxes that are separated along one axis: a straight line
 * across the facing borders when they overlap on the other axis, otherwise one
 * orthogonal Z between the facing sides. `undefined` when the boxes overlap.
 */
function facingRoute(
  s: AbsBox,
  t: AbsBox
): { start: Pt; end: Pt; bends: Pt[] } | undefined {
  const MIN_OVERLAP = 20;
  const below = t.y >= s.y + s.h;
  const above = s.y >= t.y + t.h;
  const rightOf = t.x >= s.x + s.w;
  const leftOf = s.x >= t.x + t.w;

  if (below || above) {
    const y1 = below ? s.y + s.h : s.y;
    const y2 = below ? t.y : t.y + t.h;
    const lo = Math.max(s.x, t.x);
    const hi = Math.min(s.x + s.w, t.x + t.w);
    if (hi - lo >= MIN_OVERLAP) {
      const x = (lo + hi) / 2;
      return { start: { x, y: y1 }, end: { x, y: y2 }, bends: [] };
    }
    const start = { x: s.x + s.w / 2, y: y1 };
    const end = { x: t.x + t.w / 2, y: y2 };
    return { start, end, bends: zRoute(start, end, false) };
  }
  if (rightOf || leftOf) {
    const x1 = rightOf ? s.x + s.w : s.x;
    const x2 = rightOf ? t.x : t.x + t.w;
    const lo = Math.max(s.y, t.y);
    const hi = Math.min(s.y + s.h, t.y + t.h);
    if (hi - lo >= MIN_OVERLAP) {
      const y = (lo + hi) / 2;
      return { start: { x: x1, y }, end: { x: x2, y }, bends: [] };
    }
    const start = { x: x1, y: s.y + s.h / 2 };
    const end = { x: x2, y: t.y + t.h / 2 };
    return { start, end, bends: zRoute(start, end, true) };
  }
  return undefined;
}

interface Seg {
  a: Pt;
  b: Pt;
}

/**
 * Route for an edge that runs back against the flow, from a node on the right
 * to a box on the left that lies above or below it: out of the node's left
 * side, along a free corridor and band, and into the bottom (or top) of the
 * box. The corridor and band are searched so that no run touches a foreign box
 * or lies on another edge; the cheapest free route wins.
 */
function routeAroundBoxes(
  from: AbsBox,
  to: AbsBox,
  foreign: (AbsBox & { id: string })[],
  others: Seg[],
  bounds: { w: number; h: number }
): { start: Pt; end: Pt; bends: Pt[] } | undefined {
  if (to.x + to.w > from.x) return undefined;
  const below = from.y + from.h / 2 > to.y + to.h;
  const above = from.y + from.h / 2 < to.y;
  if (!below && !above) return undefined;

  const start: Pt = { x: from.x, y: from.y + from.h / 2 };
  const end: Pt = { x: to.x + to.w / 2, y: below ? to.y + to.h : to.y };
  const m = ROUTE_CLEARANCE;
  const STEP = 4;

  const touches = (p: Pt, q: Pt) => {
    const x0 = Math.min(p.x, q.x);
    const x1 = Math.max(p.x, q.x);
    const y0 = Math.min(p.y, q.y);
    const y1 = Math.max(p.y, q.y);
    return foreign.some(
      (b) =>
        x1 > b.x - m && x0 < b.x + b.w + m && y1 > b.y - m && y0 < b.y + b.h + m
    );
  };
  const overlaps = (p: Pt, q: Pt) => {
    const horizontal = Math.abs(p.y - q.y) < 0.5;
    return others.some((o) => {
      const oh = Math.abs(o.a.y - o.b.y) < 0.5;
      if (oh !== horizontal) return false;
      if (horizontal) {
        return (
          Math.abs(o.a.y - p.y) < 10 &&
          Math.min(Math.max(o.a.x, o.b.x), Math.max(p.x, q.x)) -
            Math.max(Math.min(o.a.x, o.b.x), Math.min(p.x, q.x)) >
            2
        );
      }
      return (
        Math.abs(o.a.x - p.x) < 10 &&
        Math.min(Math.max(o.a.y, o.b.y), Math.max(p.y, q.y)) -
          Math.max(Math.min(o.a.y, o.b.y), Math.min(p.y, q.y)) >
          2
      );
    });
  };

  let best: { cost: number; pts: Pt[] } | undefined;
  const yFrom = below ? end.y + m : 0;
  const yTo = below ? bounds.h : end.y - m;
  const ys = new Set<number>([start.y]);
  for (let y = yFrom; y <= yTo; y += STEP) ys.add(y);
  for (let xv = start.x - m; xv >= end.x; xv -= STEP) {
    if (touches(start, { x: xv, y: start.y })) continue;
    if (overlaps(start, { x: xv, y: start.y })) continue;
    for (const yh of ys) {
      if (below ? yh < end.y + m : yh > end.y - m) continue;
      const p1 = { x: xv, y: start.y };
      const p2 = { x: xv, y: yh };
      const p3 = { x: end.x, y: yh };
      if (touches(p1, p2) || touches(p2, p3) || touches(p3, end)) continue;
      if (overlaps(p1, p2) || overlaps(p2, p3) || overlaps(p3, end)) continue;
      const pts = [start, p1, p2, p3, end].filter(
        (p, i, all) => i === 0 || p.x !== all[i - 1].x || p.y !== all[i - 1].y
      );
      const bends = pts.length - 2;
      const length = pts
        .slice(1)
        .reduce(
          (sum, p, i) =>
            sum + Math.abs(p.x - pts[i].x) + Math.abs(p.y - pts[i].y),
          0
        );
      const cost = length + 40 * bends;
      if (!best || cost < best.cost) best = { cost, pts };
    }
  }
  if (!best) return undefined;
  return { start, end, bends: best.pts.slice(1, -1) };
}

/**
 * Routes the edges the builder withheld from layering (see
 * `deferLineCrossingEdges`) between the final node boxes, as one orthogonal
 * Z, and appends them to the container that owns them.
 */
function routeDeferredEdges(root: ElkNode): void {
  const abs = absolutePositions(root);
  const nodes = new Map<string, ElkNode>();
  const portSide = new Map<string, { owner: string; side?: string }>();
  walk(root, (n) => {
    nodes.set(n.id, n);
    n.ports?.forEach((p) =>
      portSide.set(p.id, {
        owner: n.id,
        side: (p.layoutOptions as Record<string, string> | undefined)?.[
          'elk.port.side'
        ],
      })
    );
  });

  const anchor = (
    ref: string,
    towards: Pt
  ): { point: Pt; vertical: boolean } | undefined => {
    const port = portSide.get(ref);
    const node = nodes.get(port?.owner ?? ref);
    const pos = abs.get(port?.owner ?? ref);
    if (!node || !pos) return undefined;
    const w = node.width ?? 0;
    const h = node.height ?? 0;
    const cx = pos.x + w / 2;
    const cy = pos.y + h / 2;

    if (port?.side && SIDE_VECTOR[port.side]) {
      const v = SIDE_VECTOR[port.side];
      return {
        point: { x: cx + (v.x * w) / 2, y: cy + (v.y * h) / 2 },
        vertical: v.y !== 0,
      };
    }
    // Leave through the side that faces the other end.
    const dx = towards.x - cx;
    const dy = towards.y - cy;
    const vertical = Math.abs(dy) * w >= Math.abs(dx) * h;
    return vertical
      ? { point: { x: cx, y: cy + (dy >= 0 ? h / 2 : -h / 2) }, vertical }
      : { point: { x: cx + (dx >= 0 ? w / 2 : -w / 2), y: cy }, vertical };
  };

  const center = (ref: string): Pt | undefined => {
    const id = portSide.get(ref)?.owner ?? ref;
    const n = nodes.get(id);
    const p = abs.get(id);
    return n && p
      ? { x: p.x + (n.width ?? 0) / 2, y: p.y + (n.height ?? 0) / 2 }
      : undefined;
  };

  const parentOf = new Map<string, string | undefined>();
  const indexParents = (n: ElkNode, parent?: ElkNode) => {
    parentOf.set(n.id, parent?.id);
    n.children?.forEach((c) => indexParents(c, n));
  };
  indexParents(root);
  const lineageOf = (id: string): Set<string> => {
    const set = new Set<string>();
    for (let c: string | undefined = id; c; c = parentOf.get(c)) set.add(c);
    return set;
  };
  /** Boxes a route between the two nodes must keep clear of. */
  const foreignBoxes = (a: string, b: string) => {
    const related = new Set([...lineageOf(a), ...lineageOf(b)]);
    const out: (AbsBox & { id: string })[] = [];
    nodes.forEach((n, id) => {
      const p = abs.get(id);
      if (!p || n === root || n.properties?.type === LAYOUT_LINE_TYPE) return;
      if (related.has(id)) return;
      // anything inside the target or source belongs to it
      const lineage = lineageOf(id);
      if (lineage.has(a) || lineage.has(b)) return;
      out.push({ id, ...p, w: n.width ?? 0, h: n.height ?? 0 });
    });
    return out;
  };
  /** Runs of the edges routed so far. */
  const existingSegments = (): Seg[] => {
    const segs: Seg[] = [];
    walk(root, (n) => {
      (n.edges ?? []).forEach((edge: ElkEdge) => {
        if (isLayoutOnlyEdge(edge)) return;
        const origin = abs.get(edge.container ?? n.id) ?? { x: 0, y: 0 };
        edge.sections?.forEach((sec) => {
          const pts = [
            sec.startPoint,
            ...(sec.bendPoints ?? []),
            sec.endPoint,
          ].map((p) => ({ x: p.x + origin.x, y: p.y + origin.y }));
          pts.slice(1).forEach((p, i) => segs.push({ a: pts[i], b: p }));
        });
      });
    });
    return segs;
  };

  walk(root, (container) => {
    const deferred = container.properties?.deferredEdges;
    if (!deferred || deferred.length === 0) return;
    const origin = abs.get(container.id) ?? { x: 0, y: 0 };
    const toFrame = (p: Pt): Pt => ({ x: p.x - origin.x, y: p.y - origin.y });

    for (const edge of deferred) {
      const sc = center(edge.sources[0]);
      const tc = center(edge.targets[0]);
      if (!sc || !tc) continue;

      // Without an explicit port side, leave through the facing borders.
      const sourceId = portSide.get(edge.sources[0])?.owner ?? edge.sources[0];
      const targetId = portSide.get(edge.targets[0])?.owner ?? edge.targets[0];
      const explicitSide =
        portSide.get(edge.sources[0])?.side ||
        portSide.get(edge.targets[0])?.side;
      const sn = nodes.get(sourceId);
      const tn = nodes.get(targetId);
      const sp = abs.get(sourceId);
      const tp = abs.get(targetId);
      const facing =
        !explicitSide && sn && tn && sp && tp
          ? facingRoute(
              { ...sp, w: sn.width ?? 0, h: sn.height ?? 0 },
              { ...tp, w: tn.width ?? 0, h: tn.height ?? 0 }
            )
          : undefined;

      let startPoint: Pt;
      let endPoint: Pt;
      let bends: Pt[];
      const around =
        container === root && !explicitSide && sn && tn && sp && tp
          ? routeAroundBoxes(
              { ...sp, w: sn.width ?? 0, h: sn.height ?? 0 },
              { ...tp, w: tn.width ?? 0, h: tn.height ?? 0 },
              foreignBoxes(sourceId, targetId),
              existingSegments(),
              { w: root.width ?? 0, h: root.height ?? 0 }
            )
          : undefined;
      if (around) {
        startPoint = around.start;
        endPoint = around.end;
        bends = around.bends;
      } else if (facing) {
        startPoint = facing.start;
        endPoint = facing.end;
        bends = facing.bends;
      } else {
        const a = anchor(edge.sources[0], tc);
        const b = anchor(edge.targets[0], sc);
        if (!a || !b) continue;
        startPoint = a.point;
        endPoint = b.point;
        bends = zRoute(a.point, b.point, !a.vertical);
      }
      (container.edges ??= []).push({
        ...edge,
        container: container.id,
        sections: [
          {
            id: `${edge.id}_s0`,
            startPoint: toFrame(startPoint),
            endPoint: toFrame(endPoint),
            bendPoints: bends.map(toFrame),
          },
        ],
      });
    }
    delete container.properties!.deferredEdges;
  });
}

// ── Edge attachment points ──────────────────────────────────────────────────

/** Smallest distance kept between two edges that meet the same side. */
const MIN_EDGE_GAP = 16;

/**
 * A leaf node's box holds the icon on top and its caption below, so edges meet
 * its left / right side along the icon, not the whole box. These match the
 * renderer's icon (42px at 10px from the top, on a pill with 5px padding).
 */
const ICON_BAND_TOP = 5;
const ICON_BAND_HEIGHT = 52;

type Side = 'W' | 'E' | 'N' | 'S';

/** An icon node, not a container (which may be empty). */
const isIconNode = (n: ElkNode): boolean =>
  (n.children?.length ?? 0) === 0 && n.properties?.type !== 'container';

interface EdgeEnd {
  poly: Poly;
  end: 'start' | 'end';
  nodeId: string;
  side: Side;
  /** Position of the edge's other end along the side's axis, for ordering. */
  remote: number;
}

interface Poly {
  section: NonNullable<ElkEdge['sections']>[number];
  origin: Pt;
  pts: Pt[];
}

const alongAxis = (side: Side): 'x' | 'y' =>
  side === 'W' || side === 'E' ? 'y' : 'x';

/**
 * Positions of the edges that meet one side, given where each edge's other end
 * lies (already ordered). A single edge is centred. Several edges stay as close
 * to their other end as the minimum gap allows, so links between aligned boxes
 * remain straight; when the side is too short for that, they are spread evenly.
 */
function spreadAlongSide(wanted: number[], len: number): number[] {
  const n = wanted.length;
  if (n === 1) return [len / 2];
  const margin = Math.min(MIN_EDGE_GAP, len / 4);
  const room = len - 2 * margin;
  if (room < (n - 1) * MIN_EDGE_GAP) {
    return wanted.map((_, i) =>
      len / (n + 1) >= MIN_EDGE_GAP
        ? (len * (i + 1)) / (n + 1)
        : len / 2 + (i - (n - 1) / 2) * MIN_EDGE_GAP
    );
  }
  const pos = wanted.map((w) => Math.min(Math.max(w, margin), len - margin));
  for (let i = 1; i < n; i++) {
    pos[i] = Math.max(pos[i], pos[i - 1] + MIN_EDGE_GAP);
  }
  const overflow = pos[n - 1] - (len - margin);
  if (overflow > 0) {
    pos[n - 1] -= overflow;
    for (let i = n - 2; i >= 0; i--) {
      pos[i] = Math.min(pos[i], pos[i + 1] - MIN_EDGE_GAP);
    }
  }
  return pos;
}

/** Farthest a node is moved to line its icon up with the node it links to. */
const MAX_STRAIGHTEN = 60;

/**
 * An icon node linked to exactly one other node, side to side, is moved
 * vertically so the link between the two is a straight line instead of a
 * small step. The node stays inside its parent's padding and clear of its
 * siblings; when it cannot, it is left where it is. Returns true if any moved.
 */
function straightenLeafLinks(
  root: ElkNode,
  ends: EdgeEnd[],
  boxOf: (id: string) => AbsBox | undefined
): boolean {
  const info = new Map<string, { node: ElkNode; parent?: ElkNode }>();
  const index = (n: ElkNode, parent?: ElkNode) => {
    info.set(n.id, { node: n, parent });
    n.children?.forEach((c) => index(c, n));
  };
  index(root);

  const perNode = new Map<string, number>();
  const perSide = new Map<string, number>();
  for (const e of ends) {
    perNode.set(e.nodeId, (perNode.get(e.nodeId) ?? 0) + 1);
    const key = `${e.nodeId}|${e.side}`;
    perSide.set(key, (perSide.get(key) ?? 0) + 1);
  }
  /** Where a lone edge meets the node: the icon's middle, or the side's. */
  const attachY = (n: ElkNode, b: AbsBox) =>
    isIconNode(n)
      ? b.y +
        ICON_BAND_TOP +
        Math.min(ICON_BAND_HEIGHT, b.h - ICON_BAND_TOP) / 2
      : b.y + b.h / 2;

  let moved = false;
  // a link is straightened once, by moving one of its two ends
  const straightened = new Set<Poly>();
  for (const e of ends) {
    if (straightened.has(e.poly)) continue;
    const me = info.get(e.nodeId);
    if (!me?.parent || !isIconNode(me.node)) continue;
    if (e.side !== 'W' && e.side !== 'E') continue;
    if (perNode.get(e.nodeId) !== 1) continue;
    const other = ends.find((o) => o.poly === e.poly && o !== e);
    if (!other || other.nodeId === e.nodeId) continue;
    if (other.side !== 'W' && other.side !== 'E') continue;
    if (perSide.get(`${other.nodeId}|${other.side}`) !== 1) continue;
    const otherInfo = info.get(other.nodeId);
    const myBox = boxOf(e.nodeId);
    const otherBox = boxOf(other.nodeId);
    if (!otherInfo || !myBox || !otherBox) continue;

    const dy = attachY(otherInfo.node, otherBox) - attachY(me.node, myBox);
    // a node standing on its own at the top level has no neighbours to disturb,
    // so it may travel the whole way to its partner
    const limit = me.parent === root ? Infinity : MAX_STRAIGHTEN;
    if (Math.abs(dy) < 0.75 || Math.abs(dy) > limit) continue;

    const parent = me.parent;
    const pad = innerPadding(parent, parent === root);
    const y = (me.node.y ?? 0) + dy;
    const h = me.node.height ?? 0;
    if (y < pad.top || y + h > (parent.height ?? 0) - pad.bottom) continue;
    const x = me.node.x ?? 0;
    const w = me.node.width ?? 0;
    const clash = (parent.children ?? []).some(
      (s) =>
        s !== me.node &&
        x < (s.x ?? 0) + (s.width ?? 0) + 8 &&
        (s.x ?? 0) < x + w + 8 &&
        y < (s.y ?? 0) + (s.height ?? 0) + 8 &&
        (s.y ?? 0) < y + h + 8
    );
    if (clash) continue;

    me.node.y = y;
    // carry the edge's end (and the corner beside it, if the segment runs
    // along the side's normal) with the node, so it is found on the node again
    const { section } = e.poly;
    const pts = [
      section.startPoint,
      ...(section.bendPoints ?? []),
      section.endPoint,
    ];
    const i = e.end === 'start' ? 0 : pts.length - 1;
    shiftEndRun(pts, i, 'y', pts[i].y + dy);
    straightened.add(e.poly);
    moved = true;
  }
  return moved;
}

/** Top / bottom space a container keeps free of children (title band etc.). */
function innerPadding(
  container: ElkNode,
  isRoot: boolean
): { top: number; bottom: number } {
  const arranged = container.properties?.arrangement?.padding;
  if (arranged) return arranged;
  const elk = container.layoutOptions?.['elk.padding'];
  const side = (name: string) => {
    const m = elk && new RegExp(`${name}=(-?[0-9.]+)`).exec(elk);
    return m ? Number(m[1]) : undefined;
  };
  const isContainer = !isRoot && container.properties?.type === 'container';
  return {
    top: side('top') ?? (isContainer ? DEFAULT_CONTAINER_BOX.top : 0),
    bottom: side('bottom') ?? (isContainer ? DEFAULT_CONTAINER_BOX.bottom : 0),
  };
}

/**
 * Attaches every edge at the middle of the side of the node it meets. When
 * several edges meet the same side they are spread evenly across it, ordered
 * by where their other end lies, and never closer than `MIN_EDGE_GAP`.
 *
 * Only the end points and the run of corners behind each end move, so the route
 * between them (and its orthogonality) is kept; a straight edge gets one Z
 * when its two ends no longer line up.
 */
function distributeEdgeEnds(root: ElkNode): void {
  const nodes = new Map<string, ElkNode>();
  const ownerOf = new Map<string, string>();
  walk(root, (n) => {
    nodes.set(n.id, n);
    n.ports?.forEach((p) => ownerOf.set(p.id, n.id));
  });
  const owner = (ref: string | undefined) =>
    ref ? (ownerOf.get(ref) ?? ref) : undefined;

  let abs = absolutePositions(root);
  const boxOf = (id: string): AbsBox | undefined => {
    const n = nodes.get(id);
    const p = abs.get(id);
    return n && p ? { ...p, w: n.width ?? 0, h: n.height ?? 0 } : undefined;
  };

  const sideOf = (pt: Pt, b: AbsBox): Side | undefined => {
    const tol = 2;
    const inX = pt.x >= b.x - tol && pt.x <= b.x + b.w + tol;
    const inY = pt.y >= b.y - tol && pt.y <= b.y + b.h + tol;
    const candidates: [Side, number][] = [];
    if (inY) {
      candidates.push(['W', Math.abs(pt.x - b.x)]);
      candidates.push(['E', Math.abs(pt.x - (b.x + b.w))]);
    }
    if (inX) {
      candidates.push(['N', Math.abs(pt.y - b.y)]);
      candidates.push(['S', Math.abs(pt.y - (b.y + b.h))]);
    }
    const best = candidates.sort((a, c) => a[1] - c[1])[0];
    return best && best[1] <= tol ? best[0] : undefined;
  };

  const collect = () => {
    const polys: Poly[] = [];
    const ends: EdgeEnd[] = [];
    walk(root, (n) => {
      (n.edges ?? []).forEach((edge: ElkEdge) => {
        if (isLayoutOnlyEdge(edge)) return;
        const origin = abs.get(edge.container ?? n.id) ?? { x: 0, y: 0 };
        edge.sections?.forEach((section) => {
          const toAbs = (p: Pt): Pt => ({
            x: p.x + origin.x,
            y: p.y + origin.y,
          });
          const poly: Poly = {
            section,
            origin,
            pts: [
              section.startPoint,
              ...(section.bendPoints ?? []),
              section.endPoint,
            ].map(toAbs),
          };
          polys.push(poly);
          const first = poly.pts[0];
          const last = poly.pts[poly.pts.length - 1];
          const ref: [EdgeEnd['end'], string | undefined, Pt, Pt][] = [
            ['start', owner(edge.sources?.[0]), first, last],
            ['end', owner(edge.targets?.[0]), last, first],
          ];
          for (const [end, id, here, there] of ref) {
            const box = id ? boxOf(id) : undefined;
            const side = box ? sideOf(here, box) : undefined;
            if (!id || !side) continue;
            ends.push({
              poly,
              end,
              nodeId: id,
              side,
              remote: there[alongAxis(side)],
            });
          }
        });
      });
    });
    return { polys, ends };
  };

  let { ends } = collect();
  if (straightenLeafLinks(root, ends, boxOf)) {
    abs = absolutePositions(root);
    ({ ends } = collect());
  }

  const byPoly = new Map<Poly, Partial<Record<EdgeEnd['end'], EdgeEnd>>>();
  for (const e of ends) {
    byPoly.set(e.poly, { ...(byPoly.get(e.poly) ?? {}), [e.end]: e });
  }

  // Group by node side and choose each end's position along the side.
  const groups = new Map<string, EdgeEnd[]>();
  for (const e of ends) {
    const key = `${e.nodeId}|${e.side}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const target = new Map<EdgeEnd, Pt>();
  const place = (group: EdgeEnd[], remoteOf: (e: EdgeEnd) => number) => {
    const box = boxOf(group[0].nodeId)!;
    const side = group[0].side;
    const horizontalSide = side === 'W' || side === 'E';
    const node = nodes.get(group[0].nodeId);
    const isLeaf = !!node && isIconNode(node);
    // the stretch of the side the edges may use
    const from = horizontalSide ? box.y + (isLeaf ? ICON_BAND_TOP : 0) : box.x;
    const len = horizontalSide
      ? isLeaf
        ? Math.min(ICON_BAND_HEIGHT, box.h - ICON_BAND_TOP)
        : box.h
      : box.w;
    const sorted = [...group].sort((a, b) => remoteOf(a) - remoteOf(b));
    // a lone edge follows its other end only while that end lies on the icon,
    // so nearly aligned boxes are linked by a straight line; otherwise it
    // meets the middle of the icon
    const wanted = sorted.length === 1 ? remoteOf(sorted[0]) - from : NaN;
    const followsRemote = isLeaf && wanted >= 8 && wanted <= len - 8;
    const offsets = followsRemote
      ? [wanted]
      : spreadAlongSide(
          sorted.map((e) => remoteOf(e) - from),
          len
        );
    sorted.forEach((e, i) => {
      target.set(
        e,
        horizontalSide
          ? { x: side === 'W' ? box.x : box.x + box.w, y: from + offsets[i] }
          : {
              x: from + offsets[i],
              // a leaf's top / bottom edge is the icon's: the arrow runs over
              // the caption box to touch it
              y: isLeaf
                ? box.y +
                  ICON_BAND_TOP +
                  (side === 'N'
                    ? 0
                    : Math.min(ICON_BAND_HEIGHT, box.h - ICON_BAND_TOP))
                : side === 'N'
                  ? box.y
                  : box.y + box.h,
            }
      );
    });
  };
  const remoteNow = (e: EdgeEnd): number => {
    const pair = byPoly.get(e.poly);
    const other = pair?.[e.end === 'start' ? 'end' : 'start'];
    const q = other ? target.get(other) : undefined;
    return q ? q[alongAxis(e.side)] : e.remote;
  };
  // Lone edges on a container sit in the middle of their side first; lone
  // edges on an icon follow them; sides shared by several edges then aim at
  // where the other end of each edge ended up.
  const loneLeaf = (g: EdgeEnd[]) => {
    const n = nodes.get(g[0].nodeId);
    return !!n && isIconNode(n);
  };
  for (const group of groups.values()) {
    if (group.length === 1 && !loneLeaf(group)) place(group, (e) => e.remote);
  }
  for (const group of groups.values()) {
    if (group.length !== 1 || !loneLeaf(group)) continue;
    // follow the other end only once it has been placed; icon to icon stays centred
    const pair = byPoly.get(group[0].poly);
    const other = pair?.[group[0].end === 'start' ? 'end' : 'start'];
    place(group, other && target.has(other) ? remoteNow : () => NaN);
  }
  for (const group of groups.values()) {
    if (group.length > 1) place(group, remoteNow);
  }

  for (const [poly, pair] of byPoly) {
    const { pts } = poly;
    const k = pts.length - 1;
    const orthogonalAt = (i: number, j: number, axis: 'x' | 'y') =>
      Math.abs(pts[i][axis] - pts[j][axis]) < 0.75;

    if (k === 1) {
      // Straight edge: re-attach both ends, adding a Z if they no longer line up.
      const s = pair.start ? target.get(pair.start)! : pts[0];
      const t = pair.end ? target.get(pair.end)! : pts[1];
      const horizontal = pair.start
        ? alongAxis(pair.start.side) === 'y'
        : pair.end
          ? alongAxis(pair.end.side) === 'y'
          : Math.abs(pts[1].x - pts[0].x) >= Math.abs(pts[1].y - pts[0].y);
      poly.pts = [s, ...zRoute(s, t, horizontal), t];
    } else {
      for (const e of [pair.start, pair.end]) {
        if (!e) continue;
        const q = target.get(e)!;
        const axis = alongAxis(e.side);
        const i = e.end === 'start' ? 0 : k;
        const next = e.end === 'start' ? 1 : k - 1;
        // Move the corners next to this end only when that segment is
        // perpendicular to the side, so the path stays orthogonal; the whole
        // run of collinear corners moves with it.
        if (orthogonalAt(i, next, axis)) shiftEndRun(pts, i, axis, q[axis]);
        pts[i] = q;
      }
    }
    // drop corners that no longer turn (e.g. after a link was straightened)
    poly.pts = poly.pts.filter((p, i, all) => {
      if (i === 0 || i === all.length - 1) return true;
      const a = all[i - 1];
      const b = all[i + 1];
      return !(
        (Math.abs(a.x - p.x) < 0.75 && Math.abs(p.x - b.x) < 0.75) ||
        (Math.abs(a.y - p.y) < 0.75 && Math.abs(p.y - b.y) < 0.75)
      );
    });
    const rel = (p: Pt): Pt => ({
      x: p.x - poly.origin.x,
      y: p.y - poly.origin.y,
    });
    poly.section.startPoint = rel(poly.pts[0]);
    poly.section.endPoint = rel(poly.pts[poly.pts.length - 1]);
    poly.section.bendPoints = poly.pts.slice(1, -1).map(rel);
  }
}

// ── Keeping routes out of unrelated containers ─────────────────────────────

/** Clearance kept between a re-routed edge and the boxes it passes. */
const ROUTE_CLEARANCE = 8;

/**
 * ELK routes edges before containers are rearranged, so a route made of a
 * horizontal, a vertical and a horizontal run (a Z) can end up cutting through
 * a container it has nothing to do with. Such a Z gets its vertical run moved
 * to the nearest x where none of the three runs touch a foreign container or
 * node; a route that cannot be freed is left as it is.
 */
function avoidCrossedContainers(root: ElkNode): void {
  const abs = absolutePositions(root);
  const parentOf = new Map<string, string | undefined>();
  const nodes = new Map<string, ElkNode>();
  const index = (n: ElkNode, parent?: ElkNode) => {
    nodes.set(n.id, n);
    parentOf.set(n.id, parent?.id);
    n.children?.forEach((c) => index(c, n));
  };
  index(root);
  const ownerOf = new Map<string, string>();
  nodes.forEach((n) => n.ports?.forEach((p) => ownerOf.set(p.id, n.id)));
  const owner = (ref: string | undefined) =>
    ref ? (ownerOf.get(ref) ?? ref) : undefined;
  const lineage = (id: string | undefined): Set<string> => {
    const set = new Set<string>();
    for (let c = id; c; c = parentOf.get(c)) set.add(c);
    return set;
  };

  type Box = { x: number; y: number; w: number; h: number; id: string };
  const boxes: Box[] = [];
  nodes.forEach((n, id) => {
    const p = abs.get(id);
    if (!p || n === root || n.properties?.type === LAYOUT_LINE_TYPE) return;
    boxes.push({ id, ...p, w: n.width ?? 0, h: n.height ?? 0 });
  });

  const hits = (a: Pt, b: Pt, box: Box): boolean => {
    const m = ROUTE_CLEARANCE;
    const x0 = Math.min(a.x, b.x);
    const x1 = Math.max(a.x, b.x);
    const y0 = Math.min(a.y, b.y);
    const y1 = Math.max(a.y, b.y);
    return (
      x1 > box.x - m &&
      x0 < box.x + box.w + m &&
      y1 > box.y - m &&
      y0 < box.y + box.h + m
    );
  };

  walk(root, (n) => {
    (n.edges ?? []).forEach((edge: ElkEdge) => {
      if (isLayoutOnlyEdge(edge)) return;
      const origin = abs.get(edge.container ?? n.id) ?? { x: 0, y: 0 };
      const related = new Set([
        ...lineage(owner(edge.sources?.[0])),
        ...lineage(owner(edge.targets?.[0])),
      ]);
      const foreign = boxes.filter((b) => !related.has(b.id));
      edge.sections?.forEach((section) => {
        const pts = [
          section.startPoint,
          ...(section.bendPoints ?? []),
          section.endPoint,
        ].map((p) => ({ x: p.x + origin.x, y: p.y + origin.y }));
        if (pts.length !== 4) return;
        const [a, b, c, d] = pts;
        const isZ =
          Math.abs(a.y - b.y) < 0.5 &&
          Math.abs(b.x - c.x) < 0.5 &&
          Math.abs(c.y - d.y) < 0.5;
        if (!isZ) return;

        const clearAt = (x: number) =>
          !foreign.some(
            (box) =>
              hits(a, { x, y: a.y }, box) ||
              hits({ x, y: a.y }, { x, y: d.y }, box) ||
              hits({ x, y: d.y }, d, box)
          );
        if (clearAt(b.x)) return;

        const lo = Math.min(a.x, d.x) + ROUTE_CLEARANCE;
        const hi = Math.max(a.x, d.x) - ROUTE_CLEARANCE;
        let best: number | undefined;
        for (let x = lo; x <= hi; x += 2) {
          if (
            clearAt(x) &&
            (best === undefined || Math.abs(x - b.x) < Math.abs(best - b.x))
          ) {
            best = x;
          }
        }
        if (best === undefined) {
          // The runs cannot all be freed, but the bend should at least fall
          // in open space: take the middle of the gap nearest the target
          // that holds the vertical run.
          const openAt = (x: number) =>
            !foreign.some((box) => hits({ x, y: a.y }, { x, y: d.y }, box));
          if (openAt(b.x)) return;
          let near: number | undefined;
          for (let x = lo; x <= hi; x += 2) {
            if (
              openAt(x) &&
              (near === undefined || Math.abs(x - d.x) < Math.abs(near - d.x))
            ) {
              near = x;
            }
          }
          if (near === undefined) return;
          let left = near;
          let right = near;
          while (left - 2 >= lo && openAt(left - 2)) left -= 2;
          while (right + 2 <= hi && openAt(right + 2)) right += 2;
          best = (left + right) / 2;
        }
        section.bendPoints = [
          { x: best - origin.x, y: a.y - origin.y },
          { x: best - origin.x, y: d.y - origin.y },
        ];
      });
    });
  });
}

// ── Trimming empty margins ──────────────────────────────────────────────────

/** The `elk.nodeSize.minimum` a container was given, if any. */
function minimumSize(node: ElkNode): { w: number; h: number } {
  const raw = node.layoutOptions?.['elk.nodeSize.minimum'];
  const m = raw ? /\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)/.exec(raw) : null;
  return { w: m ? Number(m[1]) : 0, h: m ? Number(m[2]) : 0 };
}

/**
 * ELK sometimes leaves a margin around the content of a container that is
 * larger than the container's padding (it keeps room for edges that cross the
 * border), so two containers with identical content can differ in size. For
 * containers that arrange their own children, that margin is trimmed across
 * the arrangement: the content moves to the padding and the box shrinks to
 * fit, never below its declared minimum. Returns true if anything moved.
 */
function tightenArranged(root: ElkNode): boolean {
  let moved = false;
  const visit = (node: ElkNode) => {
    node.children?.forEach(visit);
    const arrangement = node.properties?.arrangement;
    const kids = node.children ?? [];
    if (!arrangement || kids.length === 0 || node === root) return;
    if (node.width === undefined || node.height === undefined) return;

    const pad = arrangement.padding;
    const minX = Math.min(...kids.map((k) => k.x ?? 0));
    const minY = Math.min(...kids.map((k) => k.y ?? 0));
    const maxX = Math.max(...kids.map((k) => (k.x ?? 0) + (k.width ?? 0)));
    const maxY = Math.max(...kids.map((k) => (k.y ?? 0) + (k.height ?? 0)));
    // `justify` spreads items along the main axis on purpose, so only the
    // cross axis is trimmed
    const trimX = arrangement.mainAxis === 'vertical';
    const trimY = arrangement.mainAxis === 'horizontal';
    const dx = trimX ? Math.max(0, minX - pad.left) : 0;
    const dy = trimY ? Math.max(0, minY - pad.top) : 0;
    const min = minimumSize(node);
    const width = trimX ? Math.max(min.w, maxX - dx + pad.right) : node.width;
    const height = trimY
      ? Math.max(min.h, maxY - dy + pad.bottom)
      : node.height;

    if (dx > 0.5 || dy > 0.5) {
      kids.forEach((k) => {
        k.x = (k.x ?? 0) - dx;
        k.y = (k.y ?? 0) - dy;
      });
      moved = true;
    }
    if (width < node.width - 0.5) {
      node.width = width;
      moved = true;
    }
    if (height < node.height - 0.5) {
      node.height = height;
      moved = true;
    }
  };
  visit(root);
  return moved;
}

// ── Top / bottom attachment ─────────────────────────────────────────────────

/** How far an edge runs clear of a node before it turns, in pixels. */
const SIDE_STUB = 20;

/**
 * Re-attaches the ends of edges that asked for the top or bottom of a node
 * (`layout.fromSide` / `toSide`). The route keeps its shape: it leaves the
 * requested side, runs clear of the node, and joins the old route at its first
 * corner. Routes too short to bend are left alone.
 */
function attachHintedSides(root: ElkNode): void {
  const abs = absolutePositions(root);
  const nodes = new Map<string, ElkNode>();
  const ownerOf = new Map<string, string>();
  walk(root, (n) => {
    nodes.set(n.id, n);
    n.ports?.forEach((p) => ownerOf.set(p.id, n.id));
  });
  const owner = (ref: string | undefined) =>
    ref ? (ownerOf.get(ref) ?? ref) : undefined;

  walk(root, (container) => {
    (container.edges ?? []).forEach((edge: ElkEdge) => {
      const hint = {
        source: edge.properties?.sideHintSource,
        target: edge.properties?.sideHintTarget,
      };
      if (!hint.source && !hint.target) return;
      const origin = abs.get(edge.container ?? container.id) ?? { x: 0, y: 0 };
      edge.sections?.forEach((section) => {
        let pts: Pt[] = [
          section.startPoint,
          ...(section.bendPoints ?? []),
          section.endPoint,
        ].map((p) => ({ x: p.x + origin.x, y: p.y + origin.y }));

        const reattach = (
          list: Pt[],
          id: string | undefined,
          side: 'N' | 'S'
        ) => {
          const node = id ? nodes.get(id) : undefined;
          const pos = id ? abs.get(id) : undefined;
          if (!node || !pos || list.length < 3) return list;
          const w = node.width ?? 0;
          const x = pos.x + w / 2;
          const y = side === 'N' ? pos.y : pos.y + (node.height ?? 0);
          const clear = side === 'N' ? y - SIDE_STUB : y + SIDE_STUB;
          const next = list[1];
          return [
            { x, y },
            { x, y: clear },
            { x: next.x, y: clear },
            ...(next.y === clear ? [] : [next]),
            ...list.slice(2),
          ];
        };

        if (hint.source) {
          pts = reattach(pts, owner(edge.sources?.[0]), hint.source);
        }
        if (hint.target) {
          pts = reattach(
            [...pts].reverse(),
            owner(edge.targets?.[0]),
            hint.target
          ).reverse();
        }
        const local = pts.map((p) => ({
          x: p.x - origin.x,
          y: p.y - origin.y,
        }));
        section.startPoint = local[0];
        section.endPoint = local[local.length - 1];
        section.bendPoints = local.slice(1, -1);
      });
    });
  });
}

// ── Keeping edges apart ─────────────────────────────────────────────────────

/** Edges whose parallel runs lie closer than this read as one line. */
const RUN_SEPARATION = 8;

/**
 * Two edges that share a stretch of the same line look like one arrow. For each
 * inner run of an edge (never the runs at its ends, which sit on a node) that
 * lies on another edge's run, the run is moved sideways to the nearest free
 * line that keeps it between its neighbouring corners.
 */
function separateParallelRuns(root: ElkNode): void {
  const abs = absolutePositions(root);
  interface Route {
    section: ElkEdgeSection;
    origin: Pt;
    pts: Pt[];
  }
  const routes: Route[] = [];
  walk(root, (n) => {
    (n.edges ?? []).forEach((edge: ElkEdge) => {
      if (isLayoutOnlyEdge(edge)) return;
      const origin = abs.get(edge.container ?? n.id) ?? { x: 0, y: 0 };
      edge.sections?.forEach((section) => {
        routes.push({
          section,
          origin,
          pts: [
            section.startPoint,
            ...(section.bendPoints ?? []),
            section.endPoint,
          ].map((p) => ({ x: p.x + origin.x, y: p.y + origin.y })),
        });
      });
    });
  });

  const overlap = (a0: number, a1: number, b0: number, b1: number) =>
    Math.min(Math.max(a0, a1), Math.max(b0, b1)) -
    Math.max(Math.min(a0, a1), Math.min(b0, b1));

  /** True if the run p→q lies on a run of any route other than `self`. */
  const crowded = (self: Route, p: Pt, q: Pt): boolean => {
    const vertical = Math.abs(p.x - q.x) < 0.5;
    return routes.some((other) => {
      if (other === self) return false;
      return other.pts.slice(1).some((b, i) => {
        const a = other.pts[i];
        const bVertical = Math.abs(a.x - b.x) < 0.5;
        if (bVertical !== vertical) return false;
        return vertical
          ? Math.abs(a.x - p.x) < RUN_SEPARATION &&
              overlap(a.y, b.y, p.y, q.y) > 2
          : Math.abs(a.y - p.y) < RUN_SEPARATION &&
              overlap(a.x, b.x, p.x, q.x) > 2;
      });
    });
  };

  routes.forEach((route) => {
    const { pts } = route;
    let changed = false;
    // inner runs only: neither end of the run is the route's own start or end
    for (let i = 1; i + 2 < pts.length; i++) {
      const p = pts[i];
      const q = pts[i + 1];
      const vertical = Math.abs(p.x - q.x) < 0.5;
      const horizontal = Math.abs(p.y - q.y) < 0.5;
      if (!vertical && !horizontal) continue;
      if (!crowded(route, p, q)) continue;

      const axis = vertical ? 'x' : 'y';
      const before = pts[i - 1][axis];
      const after = pts[i + 2][axis];
      const lo = Math.min(before, after) + 2;
      const hi = Math.max(before, after) - 2;
      const here = p[axis];
      for (const step of [1, -1, 2, -2, 3, -3]) {
        const to = here + step * RUN_SEPARATION * 2;
        if (to < lo || to > hi) continue;
        const a = { ...p, [axis]: to };
        const b = { ...q, [axis]: to };
        if (crowded(route, a, b)) continue;
        pts[i] = a;
        pts[i + 1] = b;
        changed = true;
        break;
      }
    }
    if (!changed) return;
    const local = pts.map((pt) => ({
      x: pt.x - route.origin.x,
      y: pt.y - route.origin.y,
    }));
    route.section.startPoint = local[0];
    route.section.endPoint = local[local.length - 1];
    route.section.bendPoints = local.slice(1, -1);
  });
}
