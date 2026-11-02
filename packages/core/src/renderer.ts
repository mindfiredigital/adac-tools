import fs from 'fs-extra';
import ELK from 'elkjs';
import {
  type ElkNode,
  type ElkEdge,
  LAYOUT_LINE_TYPE,
  applyLayoutPostProcessing,
  isLayoutOnlyEdge,
} from '@mindfiredigital/adac-layout-elk';
import { layoutDagre } from '@mindfiredigital/adac-layout-dagre';
import { createLayoutEngine } from '@mindfiredigital/adac-layout';

const CSS_STYLES = `
  /* ── Design Tokens ──────────────────────────────────── */
  :root {
    /* Canvas */
    --canvas-bg:        #EEF2F7;
    --canvas-padding:   40px;

    /* Typography */
    --font-aws:         "Amazon Ember", "Inter", "Segoe UI", 
                        system-ui, sans-serif;
    --font-gcp:         "Google Sans", "Product Sans", 
                        Roboto, system-ui, sans-serif;
    --font-azure:       "Segoe UI", "Inter", 
                        system-ui, sans-serif;

    /* Text colors */
    --text-900:         #0F172A;
    --text-600:         #475569;
    --text-400:         #94A3B8;

    /* Node card */
    --card-bg:          #FFFFFF;
    --card-border:      #DDE3ED;
    --card-radius:      10px;

    /* ── AWS Brand ── */
    --aws-orange:       #FF9900;
    --aws-dark:         #232F3E;
    --aws-hover:        #EC7211;

    --aws-vpc-bg:       #F9F4FF;
    --aws-vpc-border:   #7C3AED;

    --aws-az-bg:        #F8FAFC;
    --aws-az-border:    #B0BACC;

    --aws-pub-bg:       #F0FDF4;
    --aws-pub-border:   #16A34A;

    --aws-priv-bg:      #F0F9FF;
    --aws-priv-border:  #0369A1;

    --aws-cluster-bg:   #FFFBEB;
    --aws-cluster-border: #D97706;

    --aws-edge:         #8FA3BF;

    /* ── GCP Brand ── */
    --gcp-blue:         #1A73E8;
    --gcp-green:        #1E8E3E;
    --gcp-red:          #D93025;
    --gcp-yellow:       #F9AB00;

    --gcp-vpc-bg:       #EEF2FF;
    --gcp-vpc-border:   #1A73E8;

    --gcp-region-bg:    #F0FDF4;
    --gcp-region-border: #1E8E3E;

    --gcp-zone-bg:      #F5F8FF;
    --gcp-zone-border:  #4285F4;

    --gcp-subnet-bg:    #EEF2FF;
    --gcp-subnet-border: #1A73E8;

    --gcp-cluster-bg:   #FFF7ED;
    --gcp-cluster-border: #EA580C;

    --gcp-edge:         #4285F4;

    /* ── Azure Brand ── */
    --azure-blue:       #0078D4;
    --azure-dark:       #003366;

    --azure-rg-bg:      #EFF6FF;
    --azure-rg-border:  #0078D4;

    --azure-vnet-bg:    #DBEAFE;
    --azure-vnet-border: #2563EB;

    --azure-subnet-bg:  #EFF6FF;
    --azure-subnet-border: #0078D4;

    --azure-cluster-bg:  #FFF7ED;
    --azure-cluster-border: #EA580C;

    --azure-edge:       #0078D4;

    /* ── Compliance ── */
    --ok-color:         #16A34A;
    --fail-color:       #DC2626;
  }

  /* ── Base SVG ── */
  svg {
    font-variant-ligatures: none;
    text-rendering:         optimizeLegibility;
    shape-rendering:        geometricPrecision;
    background-color:       var(--canvas-bg);
  }

  /* ── Canvas roots ── */
  .aws-root, .gcp-root, .azure-root {
    fill:   var(--canvas-bg);
    stroke: none;
  }

  /* ═══════════════════════════════════════════════════
     AWS CONTAINERS
  ══════════════════════════════════════════════════ */
  .aws-container { fill: none; }

  .aws-vpc {
    fill:             var(--aws-vpc-bg);
    stroke:           var(--aws-vpc-border);
    stroke-dasharray: 10 5;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }
  .aws-az {
    fill:             var(--aws-az-bg);
    stroke:           var(--aws-az-border);
    stroke-dasharray: 6 4;
    stroke-width:     1.5px;
  }
  .aws-subnet-public {
    fill:             var(--aws-pub-bg);
    stroke:           var(--aws-pub-border);
    stroke-dasharray: 5 3;
    stroke-width:     1.5px;
  }
  .aws-subnet-private {
    fill:             var(--aws-priv-bg);
    stroke:           var(--aws-priv-border);
    stroke-dasharray: 5 3;
    stroke-width:     1.5px;
  }
  .aws-compute-cluster {
    fill:             var(--aws-cluster-bg);
    stroke:           var(--aws-cluster-border);
    stroke-dasharray: 6 3;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }

  /* AWS Typography */
  .aws-container-label {
    font-family:    var(--font-aws);
    font-size:      11px;
    font-weight:    700;
    fill:           var(--text-900);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .aws-node-label {
    font-family: var(--font-aws);
    font-size:   10px;
    font-weight: 500;
    fill:        var(--text-600);
  }
  .aws-edge {
    stroke:         var(--aws-edge);
    stroke-width:   1.5px;
    stroke-opacity: 0.85;
    fill:           none;
  }

  /* ── GCP CONTAINERS ── */
  .gcp-vpc {
    fill:             var(--gcp-vpc-bg);
    stroke:           var(--gcp-vpc-border);
    stroke-dasharray: 10 5;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }
  .gcp-region {
    fill:             var(--gcp-region-bg);
    stroke:           var(--gcp-region-border);
    stroke-dasharray: 6 3;
    stroke-width:     2px;
  }
  .gcp-zone {
    fill:             var(--gcp-zone-bg);
    stroke:           var(--gcp-zone-border);
    stroke-dasharray: 4 4;
    stroke-width:     1.2px;
  }
  .gcp-subnet {
    fill:             var(--gcp-subnet-bg);
    stroke:           var(--gcp-subnet-border);
    stroke-width:     1.5px;
  }
  .gcp-compute-cluster {
    fill:             var(--gcp-cluster-bg);
    stroke:           var(--gcp-cluster-border);
    stroke-dasharray: 5 3;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }

  /* GCP Typography */
  .gcp-container-label {
    font-family:    var(--font-gcp);
    font-size:      11px;
    font-weight:    700;
    fill:           var(--text-900);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .gcp-node-label {
    font-family: var(--font-gcp);
    font-size:   10px;
    font-weight: 400;
    fill:        var(--text-600);
  }
  .gcp-edge {
    stroke:         var(--gcp-edge);
    stroke-width:   1.5px;
    stroke-opacity: 0.75;
    fill:           none;
  }

  /* ── Azure Containers ── */
  .azure-rg {
    fill:             var(--azure-rg-bg);
    stroke:           var(--azure-rg-border);
    stroke-dasharray: 10 5;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }
  .azure-subscription {
    fill:             var(--azure-vnet-bg);
    stroke:           var(--azure-vnet-border);
    stroke-dasharray: 6 3;
    stroke-width:     2px;
  }
  .azure-container {
    fill:             var(--azure-subnet-bg);
    stroke:           var(--azure-subnet-border);
    stroke-dasharray: 5 3;
    stroke-width:     1.5px;
  }
  .azure-compute-cluster {
    fill:             var(--azure-cluster-bg);
    stroke:           var(--azure-cluster-border);
    stroke-dasharray: 5 3;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }

  /* Azure Typography */
  .azure-container-label {
    font-family:    var(--font-azure);
    font-size:      11px;
    font-weight:    700;
    fill:           var(--text-900);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .azure-node-label {
    font-family: var(--font-azure);
    font-size:   10px;
    font-weight: 400;
    fill:        var(--text-600);
  }
  .azure-edge {
    stroke:         var(--azure-edge);
    stroke-width:   1.5px;
    stroke-opacity: 0.70;
    fill:           none;
  }

  /* ── SERVICE NODE CARDS ── */
  .node-card {
    fill:   var(--card-bg);
    stroke: var(--card-border);
    stroke-width: 1px;
    filter: url(#nodeShadow);
  }
  /* No card behind the icon unless background is enabled (global or per element) */
  .node-card-plain {
    fill:           transparent;
    stroke:         none;
    filter:         none;
    pointer-events: all;
  }
  .node-icon-bg-plain {
    fill: transparent;
  }
  .node-icon-bg {
    fill:   #F7FAFC;
    stroke: none;
  }

  /* ── COMPLIANCE ── */
  .compliance-ok {
    stroke:       var(--ok-color) !important;
    stroke-width: 2px !important;
  }
  .compliance-fail {
    stroke:       var(--fail-color) !important;
    stroke-width: 2px !important;
  }

  /* ── COST BADGE ── */
  .cost-badge-bg {
    fill:   #1E293B;
    rx:     4px;
  }
  .cost-badge-text {
    font-family: var(--font-aws);
    font-size:   9px;
    font-weight: 600;
    fill:        #FFFFFF;
  }

  /* ── Legend ── */
  .legend-box {
    fill:   #FFFFFF;
    stroke: #CBD5E1;
    stroke-width: 1px;
    rx:     6px;
  }
  .legend-title {
    font-family: var(--font-aws);
    font-size:   12px;
    font-weight: 700;
    fill:        #0F172A;
  }
  .legend-item-text {
    font-family: var(--font-aws);
    font-size:   10px;
    font-weight: 500;
    fill:        #475569;
  }
  .edge-label {
    font-family: var(--font-aws);
    font-size:   9px;
    font-weight: 500;
    fill:        #475569;
    paint-order: stroke;
    stroke:      #FFFFFF;
    stroke-width: 3px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

type ElkSection = NonNullable<ElkEdge['sections']>[number];

/**
 * The declarative layout adds ports, layout-only edges, invisible line groups
 * and withheld ("deferred") edges that only the ELK path understands. The other
 * engines get the plain hierarchy instead.
 */
function flattenLayoutArtifacts(root: ElkNode): ElkNode {
  const portOwner = new Map<string, string>();
  const index = (n: ElkNode) => {
    n.ports?.forEach((p) => portOwner.set(p.id, n.id));
    n.children?.forEach(index);
  };
  index(root);
  const owner = (ref: string) => portOwner.get(ref) ?? ref;

  const flatten = (n: ElkNode): ElkNode => {
    const children = (n.children ?? []).flatMap((c) =>
      c.properties?.type === LAYOUT_LINE_TYPE
        ? (c.children ?? []).map(flatten)
        : [flatten(c)]
    );
    // edges owned by an invisible line group move up to the real container
    const lineEdges = (n.children ?? [])
      .filter((c) => c.properties?.type === LAYOUT_LINE_TYPE)
      .flatMap((c) => c.edges ?? []);
    const edges = [
      ...(n.edges ?? []),
      ...lineEdges,
      ...(n.properties?.deferredEdges ?? []),
    ]
      .filter((e) => !isLayoutOnlyEdge(e))
      .map((e) => ({
        ...e,
        sources: e.sources.map(owner),
        targets: e.targets.map(owner),
      }));
    const { ports: _ports, ...rest } = n;
    void _ports;
    return { ...rest, children, edges };
  };
  return flatten(root);
}

type Pt = { x: number; y: number };

const isOrthogonal = (pts: Pt[]) =>
  pts.every(
    (p, i) =>
      i === 0 ||
      Math.abs(p.x - pts[i - 1].x) < 0.75 ||
      Math.abs(p.y - pts[i - 1].y) < 0.75
  );

/**
 * The polyline actually drawn for a routed section, honouring a per-edge
 * routing override. ELK routes a whole graph one way, so a connection that
 * declares another routing is converted here. Splines are sampled, so labels,
 * caption checks and arrow stubs follow the curve that is drawn.
 */
export function drawnPoints(s: ElkSection, routing?: string): Pt[] {
  const pts: Pt[] = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
  if (routing === 'straight') return [pts[0], pts[pts.length - 1]];
  if (routing === 'orthogonal' && !isOrthogonal(pts)) {
    // one Z per sloped segment, turning halfway along its major axis
    const out: Pt[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (Math.abs(a.x - b.x) >= 0.75 && Math.abs(a.y - b.y) >= 0.75) {
        if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
          const mx = (a.x + b.x) / 2;
          out.push({ x: mx, y: a.y }, { x: mx, y: b.y });
        } else {
          const my = (a.y + b.y) / 2;
          out.push({ x: a.x, y: my }, { x: b.x, y: my });
        }
      }
      out.push(b);
    }
    return out;
  }
  if (routing === 'polyline' && pts.length > 2 && isOrthogonal(pts)) {
    // straight segments through the middle of each inner leg
    const mids = pts.slice(1, -2).map((p, i) => ({
      x: (p.x + pts[i + 2].x) / 2,
      y: (p.y + pts[i + 2].y) / 2,
    }));
    return [pts[0], ...mids, pts[pts.length - 1]];
  }
  if (routing === 'splines' && pts.length > 2) {
    const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const out: Pt[] = [pts[0], mid(pts[0], pts[1])];
    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = out[out.length - 1];
      const c = pts[i];
      const p1 = mid(pts[i], pts[i + 1]);
      for (const t of [0.25, 0.5, 0.75, 1]) {
        const u = 1 - t;
        out.push({
          x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
          y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
        });
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  return pts;
}

/** SVG path data for one routed section, honouring a per-edge routing override. */
function edgePathData(s: ElkSection, routing?: string): string {
  const pts: Pt[] = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
  if (routing === 'splines' && pts.length > 2) {
    const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    let d = `M ${pts[0].x} ${pts[0].y}`;
    const first = mid(pts[0], pts[1]);
    d += ` L ${first.x} ${first.y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const m = mid(pts[i], pts[i + 1]);
      d += ` Q ${pts[i].x} ${pts[i].y} ${m.x} ${m.y}`;
    }
    d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
    return d;
  }
  return drawnPoints(s, routing)
    .map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`)
    .join(' ');
}

/**
 * Two connections between the same pair of nodes in opposite directions would
 * be drawn on top of each other; nudge them apart so both stay visible.
 */
export function separateOpposingEdges(
  edges: ElkEdge[],
  owner: (ref: string) => string
): void {
  const OFFSET = 4;
  const key = (a: string, b: string) =>
    a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
  const groups = new Map<string, ElkEdge[]>();
  for (const e of edges) {
    if (e.properties?.bidirectional) continue;
    const a = owner(e.sources[0]);
    const b = owner(e.targets[0]);
    if (a === b) continue;
    const k = key(a, b);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  for (const group of groups.values()) {
    const forward = group.filter(
      (e) => owner(e.sources[0]) <= owner(e.targets[0])
    );
    const backward = group.filter((e) => !forward.includes(e));
    if (forward.length === 0 || backward.length === 0) continue;
    // ends that meet a shared side are already spread apart during layout;
    // only edges that are still drawn on top of each other need nudging
    const segmentsOf = (e: ElkEdge) =>
      (e.sections ?? []).flatMap((s) => {
        const pts: Pt[] = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
        return pts.slice(1).map((p, i) => [pts[i], p] as const);
      });
    const overlap = (
      [a, b]: readonly [Pt, Pt],
      [c, d]: readonly [Pt, Pt]
    ): boolean =>
      (
        [
          ['y', 'x'],
          ['x', 'y'],
        ] as const
      ).some(([k, o]) => {
        const flat = (p: Pt, q: Pt) => Math.abs(p[k] - q[k]) < 1;
        if (!flat(a, b) || !flat(c, d) || Math.abs(a[k] - c[k]) >= 1)
          return false;
        const lo = Math.max(Math.min(a[o], b[o]), Math.min(c[o], d[o]));
        const hi = Math.min(Math.max(a[o], b[o]), Math.max(c[o], d[o]));
        return hi - lo > 1;
      });
    const fs = forward.flatMap(segmentsOf);
    const bs = backward.flatMap(segmentsOf);
    if (!fs.some((f) => bs.some((g) => overlap(f, g)))) continue;
    const shift = (list: ElkEdge[], d: number) =>
      list.forEach((e) =>
        e.sections?.forEach((s) => {
          const pts: Pt[] = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
          const last = pts.length - 1;
          // an end on a horizontal segment meets a left / right side
          const flatAt = (i: number) =>
            Math.abs(pts[i === 0 ? 1 : last - 1].y - pts[i].y) < 0.75;
          const flatStart = flatAt(0);
          const flatEnd = flatAt(last);
          pts.forEach((pt, i) => {
            if (i === 0 || i === last) {
              // slide an end along the side it meets, not into the node
              if (i === 0 ? flatStart : flatEnd) pt.y += d;
              else pt.x += d;
            } else {
              pt.x += d;
              pt.y += d;
            }
          });
        })
      );
    shift(forward, OFFSET);
    shift(backward, -OFFSET);
  }
}

const escapeXml = (text: string) =>
  text.replace(
    /[<>&'"]/g,
    (c) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      })[c] as string
  );

interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const boxesOverlap = (a: LabelBox, b: LabelBox, pad = 0) =>
  a.x < b.x + b.w + pad &&
  b.x < a.x + a.w + pad &&
  a.y < b.y + b.h + pad &&
  b.y < a.y + a.h + pad;

/**
 * Chooses where to draw an edge label. Every segment (and, on long ones, its
 * quarter points) is a candidate; the label goes on the longest spot that fits
 * and stays clear of nodes, container headers and labels already placed, so it
 * never sits on top of text. Falls back to the longest segment's midpoint.
 */
function placeEdgeLabel(
  points: { x: number; y: number }[],
  textLen: number,
  obstacles: LabelBox[],
  placed: LabelBox[]
): { x: number; y: number; box: LabelBox } {
  const W = textLen + 4;
  const H = 14;
  const boxAt = (x: number, y: number): LabelBox => ({
    x: x - W / 2,
    y: y - 10,
    w: W,
    h: H,
  });

  interface Candidate {
    x: number;
    y: number;
    len: number;
    fits: boolean;
    box: LabelBox;
  }
  const candidates: Candidate[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    const fits = len >= (horizontal ? W + 8 : H + 8);
    const ts =
      len > 2 * W
        ? [0.5, 0.3, 0.7, 0.15, 0.85]
        : len > W + 16
          ? [0.5, 0.25, 0.75]
          : [0.5];
    for (const t of ts) {
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t - 6;
      candidates.push({ x, y, len, fits, box: boxAt(x, y) });
    }
  }

  const clear = (c: Candidate) =>
    !obstacles.some((o) => boxesOverlap(c.box, o, 2)) &&
    !placed.some((o) => boxesOverlap(c.box, o, 2));
  const longest = (list: Candidate[]) =>
    list.reduce<Candidate | undefined>(
      (best, c) => (!best || c.len > best.len ? c : best),
      undefined
    );

  const chosen =
    longest(candidates.filter((c) => c.fits && clear(c))) ??
    longest(candidates.filter(clear)) ??
    longest(candidates);
  if (!chosen) {
    const p = points[0] ?? { x: 0, y: 0 };
    return { x: p.x, y: p.y - 6, box: boxAt(p.x, p.y - 6) };
  }
  return { x: chosen.x, y: chosen.y, box: chosen.box };
}

function getProvider(node: ElkNode): 'aws' | 'gcp' | 'azure' {
  const cssClass = (node.properties?.cssClass as string) || '';
  if (cssClass.startsWith('gcp-')) return 'gcp';
  if (cssClass.startsWith('azure-')) return 'azure';
  if (cssClass.startsWith('aws-')) return 'aws';

  if (node.children) {
    for (const child of node.children) {
      const p = getProvider(child);
      if (p !== 'aws') return p;
    }
  }
  return 'aws';
}

export async function renderSvg(
  graph: ElkNode,
  layoutEngine: 'elk' | 'dagre' | 'custom' = 'elk',
  complianceTooltipMap?: Record<
    string,
    { frameworks: string[]; violations: string[] }
  >,
  optimizationTooltipMap?: Record<string, { recommendations: string[] }>,
  perServiceCosts?: Record<string, number>,
  period: 'hourly' | 'daily' | 'monthly' | 'yearly' = 'monthly'
): Promise<string> {
  let layout: ElkNode;
  const source = layoutEngine === 'elk' ? graph : flattenLayoutArtifacts(graph);

  if (layoutEngine === 'custom') {
    // ── Hierarchical custom layout ──────────────────────────────
    // Recursively lays out children within each container,
    // preserving the nesting. Children are arranged in a grid
    // when there are many siblings. Cross-container edges are
    // routed using absolute node positions with orthogonal paths.

    const CONTAINER_PAD = 48; // padding inside container boundaries
    const CONTAINER_TOP = 44; // extra top padding for label strip
    const MAX_COLS = 4; // max children per row before wrapping
    const NODE_GAP_X = 56; // horizontal gap between children
    const NODE_GAP_Y = 80; // vertical gap between rows

    // Collect ALL original edges from every level for rendering later
    const allOriginalEdges: ElkEdge[] = [];
    const collectAllEdges = (node: ElkNode) => {
      if (node.edges) allOriginalEdges.push(...node.edges);
      node.children?.forEach(collectAllEdges);
    };
    collectAllEdges(source);

    /**
     * Recursively lay out a node's children.
     * Uses the core engine when there are edges between children
     * (to get proper rank-based ordering). Falls back to grid
     * layout when children are disconnected.
     */
    const layoutNode = async (node: ElkNode): Promise<ElkNode> => {
      // Leaf node: return as-is
      if (!node.children || node.children.length === 0) {
        return {
          ...node,
          width: node.width || 96,
          height: node.height || 116,
          children: [],
          edges: [],
        };
      }

      // Container: recursively lay out children first
      const laidOutChildren: ElkNode[] = [];
      for (const child of node.children) {
        laidOutChildren.push(await layoutNode(child));
      }

      // Check if there are any local edges between direct children
      const childIds = new Set(laidOutChildren.map((c) => c.id));
      const localEdges: ElkEdge[] = [];
      if (node.edges) {
        for (const edge of node.edges) {
          if (childIds.has(edge.sources[0]) && childIds.has(edge.targets[0])) {
            localEdges.push(edge);
          }
        }
      }

      let positionedChildren: ElkNode[];

      if (localEdges.length > 0 && laidOutChildren.length <= MAX_COLS * 3) {
        // Use the core engine for rank-based layout when there are edges
        const engine = await createLayoutEngine('custom', {
          rankdir: 'TB',
          nodesep: NODE_GAP_X,
          ranksep: NODE_GAP_Y,
        });

        for (const child of laidOutChildren) {
          engine.addNode(child.id, {
            width: child.width || 96,
            height: child.height || 116,
          });
        }
        for (const edge of localEdges) {
          engine.addEdge(edge.sources[0], edge.targets[0]);
        }

        const result = await engine.layout();
        positionedChildren = laidOutChildren.map((child) => {
          const pos = result.nodes[child.id];
          if (pos) {
            return {
              ...child,
              x: pos.x + CONTAINER_PAD,
              y: pos.y + CONTAINER_TOP,
            };
          }
          return child;
        });
      } else {
        // Grid layout: wrap children into rows of MAX_COLS
        const cols = Math.min(laidOutChildren.length, MAX_COLS);
        positionedChildren = laidOutChildren.map((child, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);

          // Calculate X position: sum of widths in this row before this col
          let x = CONTAINER_PAD;
          for (let c = 0; c < col; c++) {
            const prevIdx = row * cols + c;
            if (prevIdx < laidOutChildren.length) {
              x += (laidOutChildren[prevIdx].width || 96) + NODE_GAP_X;
            }
          }

          // Calculate Y position: sum of max heights of rows above
          let y = CONTAINER_TOP;
          for (let r = 0; r < row; r++) {
            let maxH = 0;
            for (let c = 0; c < cols; c++) {
              const idx = r * cols + c;
              if (idx < laidOutChildren.length) {
                maxH = Math.max(maxH, laidOutChildren[idx].height || 116);
              }
            }
            y += maxH + NODE_GAP_Y;
          }

          return { ...child, x, y };
        });
      }

      // Compute container size from children bounds
      let maxX = 0,
        maxY = 0;
      positionedChildren.forEach((child) => {
        maxX = Math.max(maxX, (child.x || 0) + (child.width || 0));
        maxY = Math.max(maxY, (child.y || 0) + (child.height || 0));
      });

      return {
        ...node,
        width: maxX + CONTAINER_PAD,
        height: maxY + CONTAINER_PAD,
        children: positionedChildren,
        edges: [],
      };
    };

    layout = await layoutNode(source);
    layout.properties = source.properties;

    // ── Build absolute positions for every node ──
    const absPositions = new Map<
      string,
      { x: number; y: number; w: number; h: number }
    >();
    const buildAbsPositions = (n: ElkNode, ox: number, oy: number) => {
      const ax = ox + (n.x || 0);
      const ay = oy + (n.y || 0);
      absPositions.set(n.id, {
        x: ax,
        y: ay,
        w: n.width || 0,
        h: n.height || 0,
      });
      n.children?.forEach((c) => buildAbsPositions(c, ax, ay));
    };
    buildAbsPositions(layout, 0, 0);

    // ── Collect LEAF node bounding boxes for collision avoidance ──
    // Only leaf nodes (no children) are obstacles — containers are not,
    // because edges legitimately pass through container boundaries.
    const leafNodeBoxes: {
      id: string;
      x: number;
      y: number;
      r: number;
      b: number;
    }[] = [];
    const collectLeafBoxes = (n: ElkNode, ox: number, oy: number) => {
      const ax = ox + (n.x || 0);
      const ay = oy + (n.y || 0);
      if (!n.children || n.children.length === 0) {
        leafNodeBoxes.push({
          id: n.id,
          x: ax,
          y: ay,
          r: ax + (n.width || 0),
          b: ay + (n.height || 0),
        });
      }
      n.children?.forEach((c) => collectLeafBoxes(c, ax, ay));
    };
    collectLeafBoxes(layout, 0, 0);

    // Build parent chain map for proper ancestor walking
    const parentChain = new Map<string, string>();
    const buildParentChain = (n: ElkNode, parentId?: string) => {
      if (parentId) parentChain.set(n.id, parentId);
      n.children?.forEach((c) => buildParentChain(c, n.id));
    };
    buildParentChain(layout);

    /**
     * Find ALL horizontal collisions for a segment at Y between x1..x2
     */
    const findAllHorizontalCollisions = (
      y: number,
      x1: number,
      x2: number,
      skipIds: Set<string>,
      margin: number = 4
    ): typeof leafNodeBoxes => {
      const lo = Math.min(x1, x2);
      const hi = Math.max(x1, x2);
      const results: typeof leafNodeBoxes = [];
      for (const box of leafNodeBoxes) {
        if (skipIds.has(box.id)) continue;
        if (
          y > box.y - margin &&
          y < box.b + margin &&
          hi > box.x - margin &&
          lo < box.r + margin
        ) {
          results.push(box);
        }
      }
      return results;
    };

    /**
     * Find ALL vertical collisions for a segment at X between y1..y2
     */
    const findAllVerticalCollisions = (
      x: number,
      y1: number,
      y2: number,
      skipIds: Set<string>,
      margin: number = 4
    ): typeof leafNodeBoxes => {
      const lo = Math.min(y1, y2);
      const hi = Math.max(y1, y2);
      const results: typeof leafNodeBoxes = [];
      for (const box of leafNodeBoxes) {
        if (skipIds.has(box.id)) continue;
        if (
          x > box.x - margin &&
          x < box.r + margin &&
          hi > box.y - margin &&
          lo < box.b + margin
        ) {
          results.push(box);
        }
      }
      return results;
    };

    /**
     * Find a clear horizontal Y that doesn't collide with any leaf
     * node across the x-range. Uses iterative re-checking (up to 5
     * passes) in case the rerouted Y itself collides with other nodes.
     */
    const findClearHorizontalY = (
      preferredY: number,
      x1: number,
      x2: number,
      skipIds: Set<string>,
      yFloor: number,
      yCeil: number,
      margin: number = EDGE_MARGIN
    ): number => {
      let y = preferredY;
      for (let pass = 0; pass < 5; pass++) {
        const cols = findAllHorizontalCollisions(y, x1, x2, skipIds, margin);
        if (cols.length === 0) return y;
        // Find the topmost and bottommost collision
        let topmost = Infinity,
          bottommost = -Infinity;
        for (const c of cols) {
          topmost = Math.min(topmost, c.y);
          bottommost = Math.max(bottommost, c.b);
        }
        const aboveY = topmost - margin;
        const belowY = bottommost + margin;
        const distAbove = Math.abs(y - aboveY);
        const distBelow = Math.abs(y - belowY);
        // Pick the closer clear path
        if (distAbove <= distBelow && aboveY >= yFloor - 100) {
          y = aboveY;
        } else {
          y = belowY;
        }
      }
      return y;
    };

    /**
     * Find a clear vertical X that doesn't collide with any leaf
     * node across the y-range. Uses iterative re-checking.
     */
    const findClearVerticalX = (
      preferredX: number,
      y1: number,
      y2: number,
      skipIds: Set<string>,
      goRight: boolean,
      margin: number = EDGE_MARGIN
    ): number => {
      let x = preferredX;
      for (let pass = 0; pass < 5; pass++) {
        const cols = findAllVerticalCollisions(x, y1, y2, skipIds, margin);
        if (cols.length === 0) return x;
        let leftmost = Infinity,
          rightmost = -Infinity;
        for (const c of cols) {
          leftmost = Math.min(leftmost, c.x);
          rightmost = Math.max(rightmost, c.r);
        }
        x = goRight ? rightmost + margin : leftmost - margin;
      }
      return x;
    };

    // ── Route ALL original edges using absolute positions ──
    const routedEdges: ElkEdge[] = [];
    const EDGE_MARGIN = 20; // clearance around nodes for edges

    allOriginalEdges.forEach((origEdge, idx) => {
      const srcId = origEdge.sources[0];
      const tgtId = origEdge.targets[0];
      const srcPos = absPositions.get(srcId);
      const tgtPos = absPositions.get(tgtId);
      if (!srcPos || !tgtPos) return;

      const srcCx = srcPos.x + srcPos.w / 2;
      const srcCy = srcPos.y + srcPos.h / 2;
      const tgtCx = tgtPos.x + tgtPos.w / 2;
      const tgtCy = tgtPos.y + tgtPos.h / 2;

      // Per-edge jitter to separate parallel edges
      const jitter = ((idx % 10) - 5) * 5;

      // Build skip set: source, target, and their parent chain up to root.
      // This prevents the edge from treating its own containers as obstacles.
      const skipIds = new Set<string>();
      const addParentChain = (nodeId: string) => {
        skipIds.add(nodeId);
        let cur = parentChain.get(nodeId);
        while (cur) {
          skipIds.add(cur);
          cur = parentChain.get(cur);
        }
      };
      addParentChain(srcId);
      addParentChain(tgtId);

      let startPt: { x: number; y: number };
      let endPt: { x: number; y: number };
      let bendPoints: { x: number; y: number }[];

      const srcBot = srcPos.y + srcPos.h;
      const srcTop = srcPos.y;
      const tgtBot = tgtPos.y + tgtPos.h;
      const tgtTop = tgtPos.y;

      if (tgtTop > srcBot - 10) {
        // ─── Target is BELOW source ───
        startPt = { x: srcCx, y: srcBot + 2 };
        endPt = { x: tgtCx, y: tgtTop - 2 };

        // Find clear horizontal Y for the crossover
        const preferredMidY = (srcBot + tgtTop) / 2 + jitter;
        const midY = findClearHorizontalY(
          preferredMidY,
          Math.min(srcCx, tgtCx),
          Math.max(srcCx, tgtCx),
          skipIds,
          srcBot,
          tgtTop
        );

        // Check vertical segments for collision and route around if needed
        const srcGoRight = tgtCx > srcCx;
        const clearSrcX = findClearVerticalX(
          srcCx,
          srcBot,
          midY,
          skipIds,
          srcGoRight
        );
        const clearTgtX = findClearVerticalX(
          tgtCx,
          midY,
          tgtTop,
          skipIds,
          srcGoRight
        );

        if (clearSrcX !== srcCx || clearTgtX !== tgtCx) {
          // Need extra bends to avoid vertical collisions
          bendPoints = [
            { x: srcCx, y: srcBot + EDGE_MARGIN },
            { x: clearSrcX, y: srcBot + EDGE_MARGIN },
            { x: clearSrcX, y: midY },
            { x: clearTgtX, y: midY },
            { x: clearTgtX, y: tgtTop - EDGE_MARGIN },
            { x: tgtCx, y: tgtTop - EDGE_MARGIN },
          ];
          // Clean up redundant bends where X values match
          bendPoints = bendPoints.filter((pt, i) => {
            if (i === 0) return true;
            const prev = bendPoints[i - 1];
            return !(pt.x === prev.x && pt.y === prev.y);
          });
        } else {
          bendPoints = [
            { x: srcCx, y: midY },
            { x: tgtCx, y: midY },
          ];
        }
      } else if (srcTop > tgtBot - 10) {
        // ─── Target is ABOVE source ───
        startPt = { x: srcCx, y: srcTop - 2 };
        endPt = { x: tgtCx, y: tgtBot + 2 };

        const preferredMidY = (tgtBot + srcTop) / 2 + jitter;
        const midY = findClearHorizontalY(
          preferredMidY,
          Math.min(srcCx, tgtCx),
          Math.max(srcCx, tgtCx),
          skipIds,
          tgtBot,
          srcTop
        );

        const goRight = tgtCx > srcCx;
        const clearSrcX = findClearVerticalX(
          srcCx,
          midY,
          srcTop,
          skipIds,
          goRight
        );
        const clearTgtX = findClearVerticalX(
          tgtCx,
          tgtBot,
          midY,
          skipIds,
          goRight
        );

        if (clearSrcX !== srcCx || clearTgtX !== tgtCx) {
          bendPoints = [
            { x: srcCx, y: srcTop - EDGE_MARGIN },
            { x: clearSrcX, y: srcTop - EDGE_MARGIN },
            { x: clearSrcX, y: midY },
            { x: clearTgtX, y: midY },
            { x: clearTgtX, y: tgtBot + EDGE_MARGIN },
            { x: tgtCx, y: tgtBot + EDGE_MARGIN },
          ];
          bendPoints = bendPoints.filter((pt, i) => {
            if (i === 0) return true;
            const prev = bendPoints[i - 1];
            return !(pt.x === prev.x && pt.y === prev.y);
          });
        } else {
          bendPoints = [
            { x: srcCx, y: midY },
            { x: tgtCx, y: midY },
          ];
        }
      } else {
        // ─── Same vertical level → horizontal routing ───
        const goRight = tgtCx > srcCx;

        startPt = {
          x: goRight ? srcPos.x + srcPos.w + 2 : srcPos.x - 2,
          y: srcCy,
        };
        endPt = {
          x: goRight ? tgtPos.x - 2 : tgtPos.x + tgtPos.w + 2,
          y: tgtCy,
        };

        // Find clear vertical X for the crossover
        const preferredMidX = (srcCx + tgtCx) / 2 + jitter;
        const midX = findClearVerticalX(
          preferredMidX,
          Math.min(srcCy, tgtCy),
          Math.max(srcCy, tgtCy),
          skipIds,
          goRight
        );

        // Check if horizontal segments collide
        const clearSrcY = findClearHorizontalY(
          srcCy,
          startPt.x,
          midX,
          skipIds,
          srcPos.y - 50,
          srcPos.y + srcPos.h + 50
        );
        const clearTgtY = findClearHorizontalY(
          tgtCy,
          midX,
          endPt.x,
          skipIds,
          tgtPos.y - 50,
          tgtPos.y + tgtPos.h + 50
        );

        if (clearSrcY !== srcCy || clearTgtY !== tgtCy) {
          startPt.y = clearSrcY;
          endPt.y = clearTgtY;
        }

        bendPoints = [
          { x: midX, y: startPt.y },
          { x: midX, y: endPt.y },
        ];
      }

      routedEdges.push({
        id: `global-e${idx}`,
        sources: [srcId],
        targets: [tgtId],
        labels: origEdge.labels,
        properties: origEdge.properties,
        sections: [
          {
            id: `global-s${idx}`,
            startPoint: startPt,
            endPoint: endPt,
            bendPoints,
          },
        ],
      });
    });

    // Attach routed edges at the root level
    layout.edges = routedEdges;
  } else if (layoutEngine === 'dagre') {
    layout = await layoutDagre(source);
  } else {
    const elk = new ELK();
    layout = (await elk.layout(graph)) as ElkNode;
    // align / justify / maxSize and routing of withheld edges
    applyLayoutPostProcessing(layout).forEach((w) => console.warn(w));
  }

  const padding = 40;
  if (layout.children && layout.children.length > 0) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    layout.children.forEach((child) => {
      const cx = child.x || 0,
        cy = child.y || 0,
        cw = child.width || 0,
        ch = child.height || 0;
      minX = Math.min(minX, cx);
      minY = Math.min(minY, cy);
      maxX = Math.max(maxX, cx + cw);
      maxY = Math.max(maxY, cy + ch);
    });

    // Also include edge coordinates in bounds calculation
    // so that routed edges are never clipped
    // Edges are stored relative to the container they were routed in, so
    // bring them to canvas coordinates first (see `frameOrigin`).
    const preShiftPos = new Map<string, { x: number; y: number }>();
    const indexPre = (n: ElkNode, ox: number, oy: number) => {
      const x = ox + (n.x || 0),
        y = oy + (n.y || 0);
      preShiftPos.set(n.id, { x, y });
      n.children?.forEach((c) => indexPre(c, x, y));
    };
    indexPre(layout, 0, 0);
    const frameOrigin = (e: ElkEdge) =>
      preShiftPos.get(e.container || layout.id) ?? { x: 0, y: 0 };

    if (layout.edges) {
      layout.edges.forEach((e) => {
        const o = frameOrigin(e);
        e.sections?.forEach((s) => {
          [s.startPoint, s.endPoint, ...(s.bendPoints || [])].forEach((p) => {
            const pt = { x: p.x + o.x, y: p.y + o.y };
            minX = Math.min(minX, pt.x);
            minY = Math.min(minY, pt.y);
            maxX = Math.max(maxX, pt.x);
            maxY = Math.max(maxY, pt.y);
          });
        });
      });
    }

    if (minX !== Infinity) {
      const shiftX = -minX + padding,
        shiftY = -minY + padding;
      layout.children.forEach((c) => {
        if (c.x !== undefined) c.x += shiftX;
        if (c.y !== undefined) c.y += shiftY;
      });

      // Shift edge coordinates by the same amount so they
      // stay aligned with the nodes after the viewBox adjustment
      // Only edges expressed in the root's own frame move with it: the others
      // are placed from their container's (already shifted) position.
      if (layout.edges) {
        layout.edges.forEach((e) => {
          if (e.container && e.container !== layout.id) return;
          e.sections?.forEach((s) => {
            s.startPoint.x += shiftX;
            s.startPoint.y += shiftY;
            s.endPoint.x += shiftX;
            s.endPoint.y += shiftY;
            s.bendPoints?.forEach((b) => {
              b.x += shiftX;
              b.y += shiftY;
            });
          });
        });
      }

      layout.width = maxX - minX + 2 * padding;
      layout.height = maxY - minY + 2 * padding;
    }
  }

  const width = layout.width || 800;
  const height = layout.height || 600;

  const getIconDataUri = (params: { path?: string }) => {
    if (!params.path || !fs.existsSync(params.path)) return null;
    try {
      const data = fs.readFileSync(params.path);
      const b64 = data.toString('base64');
      const ext = params.path.split('.').pop()?.toLowerCase();
      let mime = 'image/svg+xml';
      if (ext === 'png') mime = 'image/png';
      else if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
      return `data:${mime};base64,${b64}`;
    } catch (e) {
      console.warn(`Failed to read icon: ${params.path}`, e);
      return null;
    }
  };

  const nodeAbsPos = new Map<string, { x: number; y: number }>();
  const parentMap = new Map<string, string>();
  const mapNodePositions = (
    n: ElkNode,
    ox: number,
    oy: number,
    pid?: string
  ) => {
    const cx = ox + (n.x || 0),
      cy = oy + (n.y || 0);
    nodeAbsPos.set(n.id, { x: cx, y: cy });
    if (pid) parentMap.set(n.id, pid);
    if (n.children)
      n.children.forEach((c) => mapNodePositions(c, cx, cy, n.id));
  };
  mapNodePositions(layout, 0, 0);

  const allEdges: ElkEdge[] = [];
  const processedEdgeIds = new Set<string>();
  const collectEdges = (n: ElkNode) => {
    if (n.edges) {
      n.edges.forEach((e) => {
        if (isLayoutOnlyEdge(e)) return;
        if (e.id && processedEdgeIds.has(e.id)) return;
        if (e.id) processedEdgeIds.add(e.id);

        let containerOffset = { x: 0, y: 0 };
        let currentContainerId = e.container || n.id;

        while (currentContainerId) {
          const pos = nodeAbsPos.get(currentContainerId);
          if (pos) {
            containerOffset = pos;
            break;
          }
          // Walk up using pre-computed parentMap
          currentContainerId = parentMap.get(currentContainerId) || '';
        }

        const ge: ElkEdge = JSON.parse(JSON.stringify(e));
        if (ge.sections) {
          ge.sections.forEach((s) => {
            s.startPoint.x += containerOffset.x;
            s.startPoint.y += containerOffset.y;
            s.endPoint.x += containerOffset.x;
            s.endPoint.y += containerOffset.y;
            s.bendPoints?.forEach((b) => {
              b.x += containerOffset.x;
              b.y += containerOffset.y;
            });
          });
        }
        allEdges.push(ge);
      });
    }
    n.children?.forEach(collectEdges);
  };
  collectEdges(layout);

  const portOwner = new Map<string, string>();
  const indexPorts = (n: ElkNode) => {
    n.ports?.forEach((p) => portOwner.set(p.id, n.id));
    n.children?.forEach(indexPorts);
  };
  indexPorts(layout);
  separateOpposingEdges(allEdges, (ref) => portOwner.get(ref) ?? ref);

  const rootCssProp = (layout.properties?.cssClass || '') as string;
  const defaultEdgeClass = rootCssProp.includes('gcp')
    ? 'gcp-edge'
    : rootCssProp.includes('azure')
      ? 'azure-edge'
      : 'aws-edge';

  const defaultArrow = rootCssProp.includes('gcp')
    ? 'url(#arrow-gcp)'
    : rootCssProp.includes('azure')
      ? 'url(#arrow-azure)'
      : 'url(#arrow)';

  // Text that edge labels must not cover: every leaf node (icon + caption)
  // and the title band of every container.
  const labelObstacles: LabelBox[] = [];
  const collectObstacles = (n: ElkNode, ox: number, oy: number) => {
    const x = ox + (n.x || 0),
      y = oy + (n.y || 0);
    if (n.id !== layout.id && n.properties?.type !== LAYOUT_LINE_TYPE) {
      if (n.children && n.children.length > 0) {
        labelObstacles.push({ x, y, w: n.width || 0, h: 34 });
      } else {
        // the caption is wider than a narrow icon box
        const w = Math.max(n.width || 0, 80);
        labelObstacles.push({
          x: x - (w - (n.width || 0)) / 2,
          y,
          w,
          h: n.height || 0,
        });
      }
    }
    n.children?.forEach((c) => collectObstacles(c, x, y));
  };
  collectObstacles(layout, 0, 0);
  const placedLabels: LabelBox[] = [];

  // Captions that an edge runs across are redrawn above the edges on a white
  // patch, so the line looks cut at the text instead of striking through it.
  const captionOverlays: string[] = [];
  const captionPatches: LabelBox[] = [];
  const edgeSegments: LabelBox[] = [];
  allEdges.forEach((e) =>
    (e.sections || []).forEach((sec) => {
      const pts = drawnPoints(sec, e.properties?.routing);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        edgeSegments.push({
          x: Math.min(a.x, b.x),
          y: Math.min(a.y, b.y),
          w: Math.abs(a.x - b.x),
          h: Math.abs(a.y - b.y),
        });
      }
    })
  );
  const crossesEdge = (box: LabelBox) =>
    edgeSegments.some(
      (g) =>
        g.x <= box.x + box.w &&
        g.x + g.w >= box.x &&
        g.y <= box.y + box.h &&
        g.y + g.h >= box.y
    );

  const edgesOutput = allEdges
    .map((e) => {
      return (e.sections || [])
        .map((s) => {
          const d = edgePathData(s, e.properties?.routing);
          const markerStart = e.properties?.bidirectional
            ? ` marker-start="${defaultArrow}"`
            : '';
          let edgeSvg = `<path d="${d}" class="${defaultEdgeClass}"${markerStart} marker-end="${defaultArrow}"/>`;

          // Add edge label if available
          const edgeLabel = e.labels?.[0]?.text;
          if (edgeLabel) {
            const textLen = edgeLabel.length * 6.5;
            const spot = placeEdgeLabel(
              drawnPoints(s, e.properties?.routing),
              textLen,
              labelObstacles,
              placedLabels
            );
            placedLabels.push(spot.box);
            // Background rect keeps the text readable over the line
            edgeSvg += `<rect x="${spot.box.x}" y="${spot.box.y}" width="${spot.box.w}" height="${spot.box.h}" rx="2" fill="white" fill-opacity="0.85"/>`;
            edgeSvg += `<text x="${spot.x}" y="${spot.y}" class="edge-label" text-anchor="middle">${escapeXml(edgeLabel)}</text>`;
          }
          return edgeSvg;
        })
        .join('');
    })
    .join('');

  const resolveNodeCost = (id: string): number | undefined => {
    if (!perServiceCosts) return undefined;
    return perServiceCosts[id];
  };

  const renderNode = (node: ElkNode, offsetX = 0, offsetY = 0): string => {
    const nx = node.x || 0,
      ny = node.y || 0,
      nw = node.width || 0,
      nh = node.height || 0;

    const absX = nx + offsetX;
    const absY = ny + offsetY;

    const props = node.properties || {};
    const label = node.labels?.[0]?.text || '';
    const nodeId = node.id || '';
    const cost = resolveNodeCost(nodeId);
    const costLabel =
      cost !== undefined ? `💰 ${cost.toFixed(2)}/${period}` : '';

    const isLayoutContainer =
      props.type === 'container' &&
      /vpc|az|region|zone|subnet/.test(props.cssClass || '');

    const tooltips: string[] = [];
    if (!isLayoutContainer) {
      const comp = complianceTooltipMap?.[nodeId];
      if (comp) {
        if (comp.violations.length > 0) {
          tooltips.push(
            `⚠ Compliance Violations (${comp.frameworks.join(', ')}):`
          );
          comp.violations.forEach((v) => tooltips.push(`  • ${v}`));
        } else {
          tooltips.push(`✅ Compliant with: ${comp.frameworks.join(', ')}`);
        }
      }

      const opt = optimizationTooltipMap?.[nodeId];
      if (opt?.recommendations.length) {
        if (tooltips.length) tooltips.push('');
        tooltips.push(`💡 Optimization Suggestions:`);
        opt.recommendations.forEach((r) => tooltips.push(`  • ${r}`));
      }

      if (costLabel) {
        if (tooltips.length) tooltips.push('');
        tooltips.push(costLabel);
      }
    }

    // Invisible wrapper that only exists to realise wrapped lines
    if (props.type === LAYOUT_LINE_TYPE) {
      return (node.children ?? [])
        .map((c) => renderNode(c, absX, absY))
        .join('');
    }

    let output = `<g id="node-${nodeId}">`;
    if (tooltips.length) {
      const tooltipText = tooltips.map(escapeXml).join('\n');
      output += `<title>${tooltipText}</title>`;
    }

    if (props.type === 'container') {
      // Determine provider from cssClass
      const css = (props.cssClass || '') as string;
      const isGcpCont = css.includes('gcp');
      const isAzureCont = css.includes('azure');

      const labelCls = isAzureCont
        ? 'azure-container-label'
        : isGcpCont
          ? 'gcp-container-label'
          : 'aws-container-label';

      let rectClass = isGcpCont
        ? 'gcp-container'
        : isAzureCont
          ? 'azure-container'
          : 'aws-container';
      if (props.cssClass) rectClass += ` ${props.cssClass}`;
      // Note: complianceClass isn't defined here but exists in user logic,
      // I'll check if I need to calculate it. For now following prompt.
      // (Checking original code... it wasn't there but I'll add the hook)
      const comp = complianceTooltipMap?.[nodeId];
      const complianceClass = comp
        ? comp.violations.length > 0
          ? 'compliance-fail'
          : 'compliance-ok'
        : '';
      if (complianceClass) rectClass += ` ${complianceClass}`;

      const r = 14; // corner radius — consistent across all containers

      // 1. Container background + border
      output += `<rect x="${absX}" y="${absY}" 
        width="${nw}" height="${nh}" 
        class="${rectClass}" 
        rx="${r}" ry="${r}"/>`;

      // 2. Label strip — subtle tinted band at top
      //    Height 32px, same corner radius at top only
      output += `<path 
        d="M${absX + r},${absY} H${absX + nw - r} Q${absX + nw},${absY} ${absX + nw},${absY + r} 
           V${absY + 32} H${absX} V${absY + r} Q${absX},${absY} ${absX + r},${absY} Z" 
        fill="currentColor" fill-opacity="0.07"/>`;

      // 3. Label text — vertically centered in the 32px strip
      //    x=14 gives 14px left padding, y=20 centers in strip
      const maxLabelW = nw - 56; // leave room for icon on right
      const charW = 6.5;
      const maxChars = Math.floor(maxLabelW / charW);
      const displayLabel =
        label.length > maxChars + 2
          ? label.substring(0, maxChars).trim() + '…'
          : label;

      output += `<text 
        x="${absX + 14}" y="${absY + 20}" 
        class="${labelCls}" 
        dominant-baseline="middle">${escapeXml(displayLabel)}</text>`;

      // 4. Provider icon (top-right corner, 20×20)
      if (props.iconPath) {
        const iconUri = getIconDataUri({ path: props.iconPath });
        if (iconUri) {
          output += `<image 
            href="${iconUri}" 
            x="${absX + nw - 28}" y="${absY + 6}" 
            width="20" height="20"
            preserveAspectRatio="xMidYMid meet"/>`;
        }
      }
    } else {
      const comp = complianceTooltipMap?.[nodeId];
      const complianceClass = comp
        ? comp.violations.length > 0
          ? 'compliance-fail'
          : 'compliance-ok'
        : '';

      // ── Constants ──────────────────────────────────────
      const ICON_SIZE = 42; // icon image size in px
      const ICON_BG_PAD = 5; // padding around icon background
      const CARD_W = nw;
      const CAPTION_W = Math.max(nw, 80);
      const CARD_H = nh;

      // Icon centered horizontally
      const iconX = absX + Math.round((CARD_W - ICON_SIZE) / 2);
      // Icon top margin: 10px from top of card
      const iconY = absY + 10;
      // Label starts 8px below icon bottom
      const labelStartY = iconY + ICON_SIZE + 9;

      // Provider detection for label class
      const rootCss = (layout.properties?.cssClass || '') as string;
      const isGcpLeaf = rootCss.includes('gcp');
      const isAzureLeaf = rootCss.includes('azure');
      const nodeLabelCls = isAzureLeaf
        ? 'azure-node-label'
        : isGcpLeaf
          ? 'gcp-node-label'
          : 'aws-node-label';

      // Compliance + base class
      // `background` (global or per element) restores the legacy white card
      const hasBackground = props.background === true;
      let cardClass = hasBackground ? 'node-card' : 'node-card node-card-plain';
      if (complianceClass) cardClass += ` ${complianceClass}`;

      // ── Card background ─────────────────────────────────
      output += `<rect x="${absX}" y="${absY}" 
        width="${CARD_W}" height="${CARD_H}" 
        class="${cardClass}" 
        rx="10" ry="10"/>`;

      // ── Icon ─────────────────────────────────────────────
      const iconUri = getIconDataUri({ path: props.iconPath });

      if (iconUri) {
        // Icon background pill
        output += `<rect 
          x="${iconX - ICON_BG_PAD}" 
          y="${iconY - ICON_BG_PAD}" 
          width="${ICON_SIZE + ICON_BG_PAD * 2}" 
          height="${ICON_SIZE + ICON_BG_PAD * 2}" 
          rx="8" ry="8" 
          class="node-icon-bg${hasBackground ? '' : ' node-icon-bg-plain'}"/>`;
        output += `<image 
          href="${iconUri}" 
          x="${iconX}" y="${iconY}" 
          width="${ICON_SIZE}" height="${ICON_SIZE}"
          preserveAspectRatio="xMidYMid meet"/>`;
      } else {
        // Fallback placeholder when no icon
        output += `<rect 
          x="${iconX}" y="${iconY}" 
          width="${ICON_SIZE}" height="${ICON_SIZE}" 
          rx="8" ry="8" 
          fill="#EDF2F7" stroke="#CBD5E1" 
          stroke-width="1"/>`;
        // Placeholder "?" text
        output += `<text 
          x="${iconX + ICON_SIZE / 2}" 
          y="${iconY + ICON_SIZE / 2 + 1}" 
          class="${nodeLabelCls}" 
          text-anchor="middle" 
          dominant-baseline="middle" 
          fill="#94A3B8" 
          font-size="16" font-weight="300">?</text>`;
      }

      // ── Cost badge (bottom-right, only if cost exists) ──
      if (cost !== undefined) {
        const badgeTxt = `$${cost.toFixed(2)}`;
        const badgeW = badgeTxt.length * 5.5 + 8;
        const badgeH = 14;
        const badgeX = absX + CARD_W - badgeW - 4;
        const badgeY = absY + CARD_H - badgeH - 4;
        output += `<rect 
          x="${badgeX}" y="${badgeY}" 
          width="${badgeW}" height="${badgeH}" 
          rx="3" ry="3" 
          fill="#1E293B"/>`;
        output += `<text 
          x="${badgeX + badgeW / 2}" 
          y="${badgeY + badgeH / 2 + 1}" 
          class="cost-badge-text" 
          text-anchor="middle" 
          dominant-baseline="middle">${escapeXml(badgeTxt)}</text>`;
      }

      // ── Label (1 or 2 lines, centered) ──────────────────
      // Max label width = card width minus 6px padding each side
      // The node box is only as wide as its icon; the caption may be wider.
      const maxLabelChars =
        props.labelMaxChars ?? Math.floor((CAPTION_W - 12) / 6.0);

      // Word-wrap: try to split into max 2 lines at word boundary
      const words = label.split(' ');
      let line1 = label;
      let line2 = '';

      if (label.length > maxLabelChars && words.length > 1) {
        // Find split point that keeps both lines under maxLabelChars
        let bestSplit = Math.ceil(words.length / 2);
        for (let s = 1; s < words.length; s++) {
          const l1 = words.slice(0, s).join(' ');
          const l2 = words.slice(s).join(' ');
          if (l1.length <= maxLabelChars && l2.length <= maxLabelChars) {
            bestSplit = s;
            break;
          }
        }
        line1 = words.slice(0, bestSplit).join(' ');
        line2 = words.slice(bestSplit).join(' ');
      }

      // Truncate if still too long
      const truncate = (t: string) =>
        t.length > maxLabelChars + 2
          ? t.substring(0, maxLabelChars).trim() + '…'
          : t;

      const LINE_H = 13; // line height in px
      // If two lines, shift first line up by half LINE_H to center block
      const baseLine1Y = line2
        ? labelStartY + Math.round(LINE_H / 2) - 2
        : labelStartY + 4;
      const captionW =
        Math.max(truncate(line1).length, truncate(line2).length) * 5.5 + 4;
      // The patch hangs from the bottom of the icon pill down over the text
      const pillBottom = iconY + ICON_SIZE + ICON_BG_PAD;
      const captionBoxAt = (y1: number): LabelBox => ({
        x: absX + CARD_W / 2 - captionW / 2,
        y: pillBottom,
        w: captionW,
        h: y1 + (line2 ? LINE_H : 0) + 2 - pillBottom,
      });
      // An arrow that ends at the icon from below has its head over the
      // caption's first line: move the caption down, clear of the head.
      const ARROW_HEAD = 11;
      const crossed = crossesEdge(captionBoxAt(baseLine1Y));
      const line1Y = baseLine1Y + (crossed ? ARROW_HEAD : 0);
      const line2Y = line1Y + LINE_H;

      let captionSvg = `<text 
        x="${absX + CARD_W / 2}" y="${line1Y}" 
        class="${nodeLabelCls}" 
        text-anchor="middle" 
        dominant-baseline="auto">${escapeXml(truncate(line1))}</text>`;

      if (line2) {
        captionSvg += `<text 
          x="${absX + CARD_W / 2}" y="${line2Y}" 
          class="${nodeLabelCls}" 
          text-anchor="middle" 
          dominant-baseline="auto">${escapeXml(truncate(line2))}</text>`;
      }

      const captionBox = captionBoxAt(line1Y);
      if (crossed) {
        captionPatches.push(captionBox);
        captionOverlays.push(
          `<rect x="${captionBox.x}" y="${captionBox.y}" width="${captionBox.w}" height="${captionBox.h}" rx="2" fill="white" fill-opacity="0.9"/>${captionSvg}`
        );
      } else {
        output += captionSvg;
      }
    }
    node.children?.forEach((c) => (output += renderNode(c, absX, absY)));
    output += '</g>';
    return output;
  };

  const provider = getProvider(layout);
  const rootRect = `<rect width="${width}" height="${height}" class="${provider}-root" />`;
  const nodesOutput = (layout.children || [])
    .map((n) => renderNode(n))
    .join('');

  // The white patches also hide arrowheads that end inside a caption; redraw
  // those last few pixels above them.
  const STUB = 12;
  const inPatch = (p: { x: number; y: number }) =>
    captionPatches.some(
      (b) =>
        p.x >= b.x - 1 &&
        p.x <= b.x + b.w + 1 &&
        p.y >= b.y - 1 &&
        p.y <= b.y + b.h + 1
    );
  const arrowStubs = allEdges
    .map((e) =>
      (e.sections || [])
        .map((sec) => {
          const pts = drawnPoints(sec, e.properties?.routing);
          const n = pts.length;
          const stub = (
            tip: { x: number; y: number },
            from: { x: number; y: number }
          ) => {
            const len = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
            const k = Math.min(STUB, len) / len;
            const a = {
              x: tip.x + (from.x - tip.x) * k,
              y: tip.y + (from.y - tip.y) * k,
            };
            return `<path d="M ${a.x} ${a.y} L ${tip.x} ${tip.y}" class="${defaultEdgeClass}" marker-end="${defaultArrow}"/>`;
          };
          let out = '';
          if (inPatch(pts[n - 1])) out += stub(pts[n - 1], pts[n - 2]);
          if (e.properties?.bidirectional && inPatch(pts[0]))
            out += stub(pts[0], pts[1]);
          return out;
        })
        .join('')
    )
    .join('');

  // ── Legend ──
  const renderLegend = () => {
    const LEGEND_W = 160;
    const LEGEND_H = 80;
    const LX = width - LEGEND_W - 20;
    const LY = height - LEGEND_H - 20;
    const edgeColor =
      provider === 'gcp'
        ? '#4285F4'
        : provider === 'azure'
          ? '#0078D4'
          : '#8FA3BF';
    const items = [
      { color: edgeColor, label: 'Relationship' },
      { color: '#16A34A', label: 'Compliant' },
      { color: '#DC2626', label: 'Non-Compliant' },
    ];
    let legendContent = `<rect x="${LX}" y="${LY}" width="${LEGEND_W}" height="${LEGEND_H}" class="legend-box" />`;
    legendContent += `<text x="${LX + 10}" y="${LY + 22}" class="legend-title">Legend</text>`;
    items.forEach((item, i) => {
      const iy = LY + 42 + i * 14;
      legendContent += `<line x1="${LX + 10}" y1="${iy}" x2="${LX + 30}" y2="${iy}" stroke="${item.color}" stroke-width="2" />`;
      legendContent += `<text x="${LX + 35}" y="${iy + 4}" class="legend-item-text">${item.label}</text>`;
    });
    return `<g id="legend">${legendContent}</g>`;
  };
  const legendOutput = renderLegend();

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto; max-width: 100%; background-color: #EEF2F7;">
  <defs>
    <style>${CSS_STYLES}</style>

    <!-- Container drop shadow: soft, barely visible -->
    <filter id="containerShadow" 
      x="-8%" y="-8%" width="116%" height="116%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
      <feOffset dx="0" dy="2" result="blur"/>
      <feFlood flood-color="#000000" flood-opacity="0.06"/>
      <feComposite in2="blur" operator="in" result="shadow"/>
      <feMerge>
        <feMergeNode in="shadow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Node card shadow: tight, crisp -->
    <filter id="nodeShadow" 
      x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
      <feOffset dx="0" dy="1" result="blur"/>
      <feFlood flood-color="#000000" flood-opacity="0.08"/>
      <feComposite in2="blur" operator="in" result="shadow"/>
      <feMerge>
        <feMergeNode in="shadow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Compliance OK: green ring glow -->
    <filter id="glowGreen" 
      x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feFlood flood-color="#16A34A" flood-opacity="0.4" 
        result="color"/>
      <feComposite in="color" in2="blur" operator="in" 
        result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Compliance FAIL: red ring glow -->
    <filter id="glowRed" 
      x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feFlood flood-color="#DC2626" flood-opacity="0.4" 
        result="color"/>
      <feComposite in="color" in2="blur" operator="in" 
        result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Arrow markers: one per provider -->
    <marker id="arrow" viewBox="0 0 10 10" 
      refX="9" refY="5" 
      markerWidth="5" markerHeight="5" 
      orient="auto-start-reverse">
      <path d="M0,1.5 L8.5,5 L0,8.5 Z" 
        fill="#8FA3BF" stroke="none"/>
    </marker>
    <marker id="arrow-gcp" viewBox="0 0 10 10" 
      refX="9" refY="5" 
      markerWidth="5" markerHeight="5" 
      orient="auto-start-reverse">
      <path d="M0,1.5 L8.5,5 L0,8.5 Z" 
        fill="#4285F4" stroke="none" fill-opacity="0.85"/>
    </marker>
    <marker id="arrow-azure" viewBox="0 0 10 10" 
      refX="9" refY="5" 
      markerWidth="5" markerHeight="5" 
      orient="auto-start-reverse">
      <path d="M0,1.5 L8.5,5 L0,8.5 Z" 
        fill="#0078D4" stroke="none" fill-opacity="0.85"/>
    </marker>
  </defs>
  ${rootRect}${nodesOutput}${edgesOutput}${captionOverlays.join('')}${arrowStubs}${legendOutput}
</svg>`;
}
