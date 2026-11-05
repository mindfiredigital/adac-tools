import type {
  AdacApplication,
  AdacCloud,
  AdacConfig,
  AdacConnection,
  AdacElementLayout,
  AdacVisual,
} from '@mindfiredigital/adac-validator';
import type { ElkEdge, ElkNode } from './types.js';
import {
  Box,
  InheritedLayout,
  NormalizedLayoutOptions,
  Warn,
  axisOf,
  chunkIntoLines,
  directionToElk,
  formatElkPadding,
  inheritLayout,
  isReversed,
  layerConstraintFor,
  lineLimitOf,
  mergePadding,
  resolvePadding,
  resolveSize,
  rootInheritedLayout,
  sideToElk,
  partitionByPosition,
  sortByOrder,
} from './layout-properties.js';

/**
 * Applies the declarative layout properties to an ELK graph produced by the
 * builder. ADAC properties are translated into ELK constraints here; the YAML
 * never carries ELK option names.
 */

/** Ids of edges that only steer the layout and are never rendered. */
export const LAYOUT_EDGE_PREFIX = '__adac_layout__';
/** `properties.type` of the invisible groups that realise wrapped lines. */
export const LAYOUT_LINE_TYPE = 'layout-line';

export function isLayoutOnlyEdge(edge: {
  id?: string;
  properties?: { layoutOnly?: boolean };
}): boolean {
  return (
    edge.properties?.layoutOnly === true ||
    (!!edge.id && edge.id.startsWith(LAYOUT_EDGE_PREFIX))
  );
}

/** Builder default for container padding (labels sit in the top band). */
export const DEFAULT_CONTAINER_BOX: Box = {
  top: 60,
  right: 40,
  bottom: 40,
  left: 40,
};

export interface DeclarativeLayoutContext {
  /** The root's edge list; edges that must not influence layering are removed from it. */
  edges: ElkEdge[];
  global: NormalizedLayoutOptions;
  visualById: Map<string, AdacVisual>;
  warn: Warn;
}

export function collectVisuals(adac: AdacConfig): Map<string, AdacVisual> {
  const map = new Map<string, AdacVisual>();
  (adac.applications || []).forEach((a: AdacApplication) => {
    if (a.visual) map.set(a.id, a.visual);
  });
  (adac.infrastructure?.clouds || []).forEach((c: AdacCloud) =>
    (c.services || []).forEach((s) => {
      if (s.visual) map.set(s.id, s.visual);
    })
  );
  return map;
}

// ── Root ────────────────────────────────────────────────────────────────────

const ELK_ROUTING = {
  orthogonal: 'ORTHOGONAL',
  polyline: 'POLYLINE',
  straight: 'POLYLINE',
  splines: 'SPLINES',
} as const;

/** ELK options derived from `layoutOptions`; only declared values are emitted. */
/**
 * Edge routing and clearance. ELK reads these from the graph an edge lives in,
 * so every container needs them, not only the root.
 */
function edgeOptions(global: NormalizedLayoutOptions): Record<string, string> {
  const o: Record<string, string> = {};
  if (global.edgeSpacing !== undefined) {
    const clearance = global.edgeSpacing;
    o['elk.spacing.edgeNode'] = String(clearance);
    o['elk.layered.spacing.edgeNodeBetweenLayers'] = String(clearance);
    o['elk.spacing.edgeEdge'] = String(clearance / 2);
    o['elk.layered.spacing.edgeEdgeBetweenLayers'] = String(clearance / 2);
  }
  if (global.edgeRouting) {
    o['elk.edgeRouting'] = ELK_ROUTING[global.edgeRouting];
  }
  return o;
}

export function rootElkOptions(
  global: NormalizedLayoutOptions
): Record<string, string> {
  const o: Record<string, string> = {};
  if (global.directionDeclared) {
    o['elk.direction'] = directionToElk(global.direction);
  }

  const flowAxis = axisOf(global.direction);
  const crossAxis = flowAxis === 'horizontal' ? 'vertical' : 'horizontal';
  const between = global.gap?.[flowAxis];
  const within = global.gap?.[crossAxis];
  if (between !== undefined)
    o['elk.layered.spacing.nodeNodeBetweenLayers'] = String(between);
  if (within !== undefined) o['elk.spacing.nodeNode'] = String(within);

  Object.assign(o, edgeOptions(global));
  return o;
}

// ── Elements ────────────────────────────────────────────────────────────────

export function applyDeclarativeLayout(
  root: ElkNode,
  ctx: DeclarativeLayoutContext
): void {
  const inherited = rootInheritedLayout(ctx.global);

  const kids = root.children ?? [];
  kids.forEach((k) => visit(k, inherited, ctx));
  root.children = orderAndArrange(root, kids, undefined, inherited, ctx, true);
  root.properties = {
    ...root.properties,
    background: ctx.global.background,
    labelMaxChars: ctx.global.labelMaxChars,
    // A global `align` also centres the top-level items on the cross axis
    // (e.g. an actor beside a large boundary box); the engine still chooses
    // their order and layers.
    ...(ctx.global.align !== undefined && kids.length > 1
      ? {
          arrangement: {
            mainAxis: axisOf(ctx.global.direction),
            align: ctx.global.align,
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            fitToItems: true,
          },
        }
      : {}),
  };
  deferBackwardEdges(root, ctx);
}

/**
 * A connection that runs into a top-level element pinned to the first layer
 * (`position: *-left`) runs against the flow. Left in the layout, ELK would
 * place the target after its source and drag it out of the first layer, so
 * these edges are taken out of the layout and routed afterwards (see
 * post-layout.ts).
 */
function deferBackwardEdges(
  root: ElkNode,
  ctx: DeclarativeLayoutContext
): void {
  const flow = ctx.global.direction;
  const topOf = new Map<string, string>();
  const first = new Set<string>();
  (root.children ?? []).forEach((child) => {
    const index = (n: ElkNode) => {
      topOf.set(n.id, child.id);
      n.ports?.forEach((p) => topOf.set(p.id, child.id));
      n.children?.forEach(index);
    };
    index(child);
    const position = ctx.visualById.get(child.id)?.layout?.position;
    if (layerConstraintFor(position, flow) === 'FIRST') first.add(child.id);
  });
  if (first.size === 0) return;

  const deferred: ElkEdge[] = [];
  for (let i = ctx.edges.length - 1; i >= 0; i--) {
    const e = ctx.edges[i];
    if (isLayoutOnlyEdge(e)) continue;
    const s = topOf.get(e.sources[0]);
    const t = topOf.get(e.targets[0]);
    if (s && t && s !== t && first.has(t) && !first.has(s)) {
      ctx.edges.splice(i, 1);
      deferred.unshift(e);
    }
  }
  if (deferred.length > 0) {
    root.properties = {
      ...root.properties,
      deferredEdges: [...(root.properties?.deferredEdges ?? []), ...deferred],
    };
  }
}

function visit(
  node: ElkNode,
  parent: InheritedLayout,
  ctx: DeclarativeLayoutContext
): void {
  const { global } = ctx;
  const visual = ctx.visualById.get(node.id);
  const own = visual?.layout;
  const resolved = inheritLayout(parent, own, global.unitSize);

  node.properties = {
    ...node.properties,
    background: visual?.style?.background ?? global.background,
    labelMaxChars: visual?.style?.labelMaxChars ?? global.labelMaxChars,
  };
  applySizing(node, own, ctx);

  const kids = node.children ?? [];
  if (kids.length === 0) return;

  const options = (node.layoutOptions ??= {});
  const ownPadding = resolvePadding(own?.padding, global.unitSize);
  if (ownPadding || global.containerPadding) {
    options['elk.padding'] = formatElkPadding(
      mergePadding(DEFAULT_CONTAINER_BOX, global.containerPadding, ownPadding)
    );
  }
  Object.assign(options, spacingOptions(resolved, axisOf(global.direction)));
  Object.assign(options, edgeOptions(global));

  kids.forEach((k) => visit(k, resolved, ctx));
  node.children = orderAndArrange(node, kids, own, resolved, ctx, false);
}

/** `gap` resolved for this container, in ELK's layer / in-layer terms. */
function spacingOptions(
  resolved: InheritedLayout,
  flowAxis: 'horizontal' | 'vertical'
): Record<string, string> {
  const o: Record<string, string> = {};
  const cross = flowAxis === 'horizontal' ? 'vertical' : 'horizontal';
  if (resolved.gap[flowAxis] !== undefined)
    o['elk.layered.spacing.nodeNodeBetweenLayers'] = String(
      resolved.gap[flowAxis]
    );
  if (resolved.gap[cross] !== undefined)
    o['elk.spacing.nodeNode'] = String(resolved.gap[cross]);
  return o;
}

function applySizing(
  node: ElkNode,
  own: AdacElementLayout | undefined,
  ctx: DeclarativeLayoutContext
): void {
  if (!own) return;
  const unit = ctx.global.unitSize;
  const size = resolveSize(own.size, unit);
  const min = resolveSize(own.minSize, unit);
  const max = resolveSize(own.maxSize, unit);

  // An exact `size` is a floor and a ceiling; it cannot shrink a container
  // below its content because ELK grows containers to fit.
  const floorW = size.width ?? min.width;
  const floorH = size.height ?? min.height;
  const ceilW = size.width ?? max.width;
  const ceilH = size.height ?? max.height;
  const isContainer = (node.children?.length ?? 0) > 0;

  if (floorW !== undefined) node.width = floorW;
  if (floorH !== undefined) node.height = floorH;

  if (isContainer) {
    if (floorW !== undefined || floorH !== undefined) {
      const options = (node.layoutOptions ??= {});
      options['elk.nodeSize.minimum'] =
        `(${node.width ?? 0}, ${node.height ?? 0})`;
    }
    if (ceilW !== undefined || ceilH !== undefined) {
      node.properties = {
        ...node.properties,
        maxSize: { width: ceilW, height: ceilH },
      };
    }
    return;
  }

  // Leaves have a definite size, so a ceiling can be applied directly.
  if (ceilW !== undefined && (node.width ?? 0) > ceilW) node.width = ceilW;
  if (ceilH !== undefined && (node.height ?? 0) > ceilH) node.height = ceilH;
  if (floorW !== undefined || floorH !== undefined || ceilW || ceilH) {
    const options = (node.layoutOptions ??= {});
    options['elk.nodeSize.minimum'] =
      `(${node.width ?? 0}, ${node.height ?? 0})`;
  }
}

// ── Ordering, positioning, line packing ─────────────────────────────────────

function orderAndArrange(
  parent: ElkNode,
  kids: ElkNode[],
  own: AdacElementLayout | undefined,
  resolved: InheritedLayout,
  ctx: DeclarativeLayoutContext,
  isRoot: boolean
): ElkNode[] {
  const { global } = ctx;
  const flow = global.direction;
  const flowAxis = axisOf(flow);

  const placementOf = (k: ElkNode) => {
    const l = ctx.visualById.get(k.id)?.layout;
    return { order: l?.order, position: l?.position };
  };
  const logical = sortByOrder(kids, placementOf);

  // Declaring `order` on a child only makes sense for a sequence, so it
  // arranges the parent along the inherited direction even if the parent
  // declared nothing itself.
  const orderDeclared = kids.some((k) => placementOf(k).order !== undefined);
  const arranged =
    !isRoot && logical.length >= 2 && (resolved.arranged || orderDeclared);

  if (!arranged) {
    // A lone child still honours `align` and `justify` (centred in a box
    // wider than it).
    if (
      !isRoot &&
      logical.length === 1 &&
      resolved.arranged &&
      (resolved.align !== undefined || needsJustify(resolved))
    ) {
      parent.properties = {
        ...parent.properties,
        arrangement: {
          mainAxis: axisOf(resolved.direction),
          align: resolved.align,
          justify: needsJustify(resolved) ? resolved.justify : undefined,
          padding: mergePadding(
            DEFAULT_CONTAINER_BOX,
            global.containerPadding,
            resolvePadding(own?.padding, global.unitSize)
          ),
        },
      };
    }
    // Not arranged: the engine's flow decides placement, `position` pins an
    // element to the first / last layer of the flow axis.
    logical.forEach((k) => {
      const constraint = layerConstraintFor(placementOf(k).position, flow);
      if (constraint) {
        (k.layoutOptions ??= {})['elk.layered.layering.layerConstraint'] =
          constraint;
      }
    });
    return logical;
  }

  // ── Arranged container: realise direction / wrapping with layout-only
  // structure, because ELK ignores per-container direction when edges cross
  // container boundaries.
  const mainAxis = axisOf(resolved.direction);
  const reversed = isReversed(resolved.direction);
  const flowPositive = !isReversed(flow);

  // The builder's automatic first/last-layer pins would fight the declared
  // sequence.
  logical.forEach((k) => {
    if (k.layoutOptions) {
      delete k.layoutOptions['elk.layered.layering.layerConstraint'];
    }
  });

  const lines = chunkIntoLines(logical, lineLimitOf(own)).map((line) =>
    partitionByPosition(
      reversed ? [...line].reverse() : line,
      placementOf,
      mainAxis
    )
  );

  const chain = (items: ElkNode[], owner: string): ElkEdge[] => {
    const seq = flowPositive ? items : [...items].reverse();
    return seq.slice(1).map((n, i) => ({
      id: `${LAYOUT_EDGE_PREFIX}${owner}__${seq[i].id}->${n.id}`,
      sources: [seq[i].id],
      targets: [n.id],
      properties: { layoutOnly: true },
    }));
  };

  const itemsFollowFlow = mainAxis === flowAxis;
  // Siblings that share an ELK layer are stacked perpendicular to the flow.
  const stackAxis = flowAxis === 'horizontal' ? 'vertical' : 'horizontal';
  const padding = mergePadding(
    DEFAULT_CONTAINER_BOX,
    global.containerPadding,
    resolvePadding(own?.padding, global.unitSize)
  );

  parent.properties = {
    ...parent.properties,
    ...(resolved.align !== undefined || needsJustify(resolved)
      ? {
          arrangement: {
            mainAxis,
            align: resolved.align,
            justify: needsJustify(resolved) ? resolved.justify : undefined,
            padding,
          },
        }
      : {}),
  };

  const edges = (parent.edges ??= []);
  deferLineCrossingEdges(parent, lines, itemsFollowFlow, flowPositive, ctx);

  if (lines.length === 1) {
    if (itemsFollowFlow) edges.push(...chain(lines[0], parent.id));
    else parent.properties.stackAxis = stackAxis;
    return lines[0];
  }

  const groups: ElkNode[] = lines.map((line, i) => ({
    id: `${parent.id}__line${i}`,
    children: line,
    edges: itemsFollowFlow ? chain(line, `${parent.id}__line${i}`) : [],
    properties: {
      type: LAYOUT_LINE_TYPE,
      ...(itemsFollowFlow ? {} : { stackAxis }),
    },
    layoutOptions: {
      'elk.padding': formatElkPadding({ top: 0, right: 0, bottom: 0, left: 0 }),
      ...spacingOptions(resolved, flowAxis),
    },
  }));
  // Lines run along the axis perpendicular to the items. If that is the flow
  // axis, chain them; otherwise they share a layer and are stacked.
  if (itemsFollowFlow) parent.properties.stackAxis = stackAxis;
  else edges.push(...chain(groups, parent.id));
  return groups;
}

/**
 * Real edges between two items that share a layer (or, for wrapped lines,
 * between two lines) would force ELK to put them in different layers and break
 * the declared arrangement. Those edges are taken out of the layout and routed
 * afterwards (see post-layout.ts).
 */
function deferLineCrossingEdges(
  parent: ElkNode,
  lines: ElkNode[][],
  itemsFollowFlow: boolean,
  flowPositive: boolean,
  ctx: DeclarativeLayoutContext
): void {
  // top-level child of `parent` that contains each descendant id
  const childOf = new Map<string, string>();
  const lineOf = new Map<string, number>();
  const placeOf = new Map<string, number>();
  lines.forEach((line, i) =>
    line.forEach((item, place) => {
      lineOf.set(item.id, i);
      placeOf.set(item.id, place);
      const index = (n: ElkNode) => {
        childOf.set(n.id, item.id);
        n.ports?.forEach((p) => childOf.set(p.id, item.id));
        n.children?.forEach(index);
      };
      index(item);
    })
  );

  const deferred: ElkEdge[] = [];
  for (let i = ctx.edges.length - 1; i >= 0; i--) {
    const e = ctx.edges[i];
    const s = childOf.get(e.sources[0]);
    const t = childOf.get(e.targets[0]);
    if (!s || !t || s === t) continue;
    const sameLine = lineOf.get(s) === lineOf.get(t);
    // items follow the flow: only edges between different lines are a problem;
    // items share a layer: edges within a line are the problem.
    // items that follow the flow are chained in order, so an edge running
    // against that order would fight the chain as well
    const against =
      itemsFollowFlow &&
      sameLine &&
      (flowPositive
        ? placeOf.get(t)! < placeOf.get(s)!
        : placeOf.get(t)! > placeOf.get(s)!);
    if (itemsFollowFlow ? !sameLine || against : sameLine) {
      ctx.edges.splice(i, 1);
      deferred.unshift(e);
    }
  }
  if (deferred.length > 0) {
    parent.properties = {
      ...parent.properties,
      deferredEdges: [...(parent.properties?.deferredEdges ?? []), ...deferred],
    };
  }
}

function needsJustify(resolved: InheritedLayout): boolean {
  return resolved.justify !== undefined && resolved.justify !== 'start';
}

// ── Connections ─────────────────────────────────────────────────────────────

export interface ConnectionLayoutResult {
  sourceRef: string;
  targetRef: string;
  properties?: ElkEdge['properties'];
}

/**
 * Resolves a connection's `layout` / `bidirectional` into ELK ports (for side
 * constraints) and edge properties (for the renderer). Endpoints stay node ids
 * when the side is `auto`.
 */
export function layoutConnection(
  conn: AdacConnection,
  edgeId: string,
  from: ElkNode | undefined,
  to: ElkNode | undefined,
  global: NormalizedLayoutOptions
): ConnectionLayoutResult {
  const fromId = from?.id ?? conn.from ?? conn.source ?? '';
  const toId = to?.id ?? conn.to ?? conn.target ?? '';
  const result: ConnectionLayoutResult = {
    sourceRef: fromId,
    targetRef: toId,
  };

  const attach = (
    node: ElkNode | undefined,
    role: 'out' | 'in',
    side: string | undefined
  ): string | undefined => {
    if (!node || !side) return undefined;
    const port = {
      id: `${node.id}__${edgeId}__${role}`,
      width: 0,
      height: 0,
      layoutOptions: { 'elk.port.side': side },
    };
    (node.ports ??= []).push(port);
    (node.layoutOptions ??= {})['elk.portConstraints'] = 'FIXED_SIDE';
    return port.id;
  };

  // A port on the top or bottom makes ELK rearrange the node's whole column,
  // so those sides are realised after layout (see post-layout.ts).
  const vertical = (side: string | undefined): 'N' | 'S' | undefined =>
    side === 'top' ? 'N' : side === 'bottom' ? 'S' : undefined;
  const sideHint = {
    source: vertical(conn.layout?.fromSide),
    target: vertical(conn.layout?.toSide),
  };
  result.sourceRef =
    attach(
      from,
      'out',
      sideHint.source ? undefined : sideToElk(conn.layout?.fromSide)
    ) ?? fromId;
  result.targetRef =
    attach(
      to,
      'in',
      sideHint.target ? undefined : sideToElk(conn.layout?.toSide)
    ) ?? toId;

  const routing = conn.layout?.routing ?? global.edgeRouting;
  const properties: NonNullable<ElkEdge['properties']> = {};
  if (sideHint.source) properties.sideHintSource = sideHint.source;
  if (sideHint.target) properties.sideHintTarget = sideHint.target;
  if (conn.bidirectional) properties.bidirectional = true;
  // ELK routes a whole graph one way; the renderer realises a connection's
  // own routing (including `orthogonal` under a non-orthogonal default)
  if (conn.layout?.routing || (routing && routing !== 'orthogonal'))
    properties.routing = routing;
  if (Object.keys(properties).length > 0) result.properties = properties;
  return result;
}
