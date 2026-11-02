import type {
  AdacElementLayout,
  AdacGap,
  AdacLayoutAlign,
  AdacLayoutDirection,
  AdacLayoutJustify,
  AdacLayoutOptions,
  AdacLayoutPosition,
  AdacPadding,
  AdacSize,
  AdacConnectionSide,
  AdacEdgeRouting,
} from '@mindfiredigital/adac-schema';

/**
 * Engine-independent resolution of the declarative layout properties
 * (`layoutOptions`, `visual.layout`, `visual.style`, connection `layout`).
 *
 * Nothing in here knows about ELK option names; `elk-builder` translates the
 * resolved values into engine constraints.
 *
 * Inheritance (documented per property, see docs/DECLARATIVE_LAYOUT.md):
 *
 *   inherited    direction, gap, align, justify
 *   local        padding, wrap, itemsPerLine, maxItemsPerLine,
 *                size, minSize, maxSize
 *   placement    order, position  (describe the element itself, never inherited)
 */

export const DEFAULT_UNIT_SIZE = 100;

export type Warn = (message: string) => void;

export interface PartialGap {
  horizontal?: number;
  vertical?: number;
}

export interface PartialBox {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface SizeConstraint {
  width?: number;
  height?: number;
}

/**
 * The single logical-unit → pixel conversion. Every length declared in ADAC
 * layout properties goes through here so no property mixes units and pixels.
 */
export function resolveUnit(
  value: number,
  unitSize: number = DEFAULT_UNIT_SIZE
): number {
  return Math.round(value * unitSize * 100) / 100;
}

export function resolveGap(
  gap: AdacGap | undefined,
  unitSize: number
): PartialGap | undefined {
  if (gap === undefined) return undefined;
  if (typeof gap === 'number') {
    const px = resolveUnit(gap, unitSize);
    return { horizontal: px, vertical: px };
  }
  const out: PartialGap = {};
  if (gap.horizontal !== undefined)
    out.horizontal = resolveUnit(gap.horizontal, unitSize);
  if (gap.vertical !== undefined)
    out.vertical = resolveUnit(gap.vertical, unitSize);
  return out;
}

export function resolvePadding(
  padding: AdacPadding | undefined,
  unitSize: number
): PartialBox | undefined {
  if (padding === undefined) return undefined;
  if (typeof padding === 'number') {
    const px = resolveUnit(padding, unitSize);
    return { top: px, right: px, bottom: px, left: px };
  }
  const out: PartialBox = {};
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const v = padding[side];
    if (v !== undefined) out[side] = resolveUnit(v, unitSize);
  }
  return out;
}

/** `auto` (or an absent dimension) resolves to "no constraint". */
export function resolveSize(
  size: AdacSize | undefined,
  unitSize: number
): SizeConstraint {
  const out: SizeConstraint = {};
  if (!size) return out;
  if (typeof size.width === 'number')
    out.width = resolveUnit(size.width, unitSize);
  if (typeof size.height === 'number')
    out.height = resolveUnit(size.height, unitSize);
  return out;
}

// ── Global options ──────────────────────────────────────────────────────────

export interface NormalizedLayoutOptions {
  engine?: 'elk' | 'dagre' | 'custom';
  unitSize: number;
  direction: AdacLayoutDirection;
  /** True when the author set `direction` rather than relying on the default. */
  directionDeclared: boolean;
  gap?: PartialGap;
  containerPadding?: PartialBox;
  align?: AdacLayoutAlign;
  justify?: AdacLayoutJustify;
  /** Pixels. */
  edgeSpacing?: number;
  edgeRouting?: AdacEdgeRouting;
  background: boolean;
  /** Draw each connection's `type` as a label on its edge. */
  edgeLabels: boolean;
  /** Most characters on one line of a node label (undefined: fit the caption). */
  labelMaxChars?: number;
}

/**
 * Applies the deprecated aliases (`unit` → `unitSize`, `routing` →
 * `edgeRouting`), emitting a warning when they are used.
 */
export function normalizeLayoutOptions(
  options: AdacLayoutOptions | undefined,
  warn: Warn = () => {}
): NormalizedLayoutOptions {
  const o = options ?? {};

  if (o.unit !== undefined) {
    warn('layoutOptions.unit is deprecated; use layoutOptions.unitSize');
  }
  if (o.routing !== undefined) {
    warn('layoutOptions.routing is deprecated; use layoutOptions.edgeRouting');
  }

  const unitSize = o.unitSize ?? o.unit ?? DEFAULT_UNIT_SIZE;
  const edgeRouting = o.edgeRouting ?? o.routing;

  return {
    engine: o.engine,
    unitSize,
    direction: o.direction ?? 'LR',
    directionDeclared: o.direction !== undefined,
    gap: resolveGap(o.gap, unitSize),
    containerPadding: resolvePadding(o.containerPadding, unitSize),
    align: o.align,
    justify: o.justify,
    edgeSpacing:
      o.edgeSpacing !== undefined
        ? resolveUnit(o.edgeSpacing, unitSize)
        : undefined,
    edgeRouting,
    background: o.background ?? false,
    edgeLabels: o.edgeLabels ?? true,
    labelMaxChars: o.labelMaxChars,
  };
}

// ── Per-element resolution ──────────────────────────────────────────────────

/** Layout state that flows from a container down to its children. */
export interface InheritedLayout {
  direction: AdacLayoutDirection;
  gap: PartialGap;
  align?: AdacLayoutAlign;
  justify?: AdacLayoutJustify;
  /**
   * True when this element, or its nearest layout-declaring ancestor,
   * declared how children are arranged. Only then are children placed by
   * the declared arrangement; otherwise the engine's own flow is kept.
   */
  arranged: boolean;
}

export function rootInheritedLayout(
  global: NormalizedLayoutOptions
): InheritedLayout {
  return {
    direction: global.direction,
    gap: { ...(global.gap ?? {}) },
    align: global.align,
    justify: global.justify,
    arranged: false,
  };
}

/** Properties that declare an arrangement of the element's children. */
const ARRANGEMENT_KEYS: (keyof AdacElementLayout)[] = [
  'direction',
  'wrap',
  'itemsPerLine',
  'maxItemsPerLine',
  'align',
  'justify',
];

export function declaresArrangement(
  layout: AdacElementLayout | undefined
): boolean {
  return !!layout && ARRANGEMENT_KEYS.some((k) => layout[k] !== undefined);
}

/**
 * Global → nearest layout-declaring ancestor → element's own properties.
 */
export function inheritLayout(
  parent: InheritedLayout,
  own: AdacElementLayout | undefined,
  unitSize: number
): InheritedLayout {
  if (!own) return parent;
  const ownGap = resolveGap(own.gap, unitSize);
  return {
    direction: own.direction ?? parent.direction,
    gap: { ...parent.gap, ...(ownGap ?? {}) },
    align: own.align ?? parent.align,
    justify: own.justify ?? parent.justify,
    arranged: parent.arranged || declaresArrangement(own),
  };
}

export interface LineLimit {
  kind: 'exact' | 'max';
  count: number;
}

/** Local (non-inherited) child-packing properties of one element. */
export function lineLimitOf(
  layout: AdacElementLayout | undefined
): LineLimit | undefined {
  if (!layout) return undefined;
  if (layout.wrap === false) return undefined;
  // the schema requires a whole number >= 1, but validation is optional;
  // anything else is ignored rather than allowed to stall line packing
  const usable = (n: number | undefined): n is number =>
    typeof n === 'number' && Number.isFinite(n) && n >= 1;
  if (usable(layout.itemsPerLine))
    return { kind: 'exact', count: Math.floor(layout.itemsPerLine) };
  if (usable(layout.maxItemsPerLine))
    return { kind: 'max', count: Math.floor(layout.maxItemsPerLine) };
  return undefined;
}

// ── Direction helpers ───────────────────────────────────────────────────────

export type Axis = 'horizontal' | 'vertical';

export function axisOf(direction: AdacLayoutDirection): Axis {
  return direction === 'LR' || direction === 'RL' ? 'horizontal' : 'vertical';
}

export function isReversed(direction: AdacLayoutDirection): boolean {
  return direction === 'RL' || direction === 'BT';
}

export function crossAxis(axis: Axis): Axis {
  return axis === 'horizontal' ? 'vertical' : 'horizontal';
}

const ELK_DIRECTION: Record<AdacLayoutDirection, string> = {
  LR: 'RIGHT',
  RL: 'LEFT',
  TB: 'DOWN',
  BT: 'UP',
};

export function directionToElk(direction: AdacLayoutDirection): string {
  return ELK_DIRECTION[direction];
}

const ELK_SIDE: Record<Exclude<AdacConnectionSide, 'auto'>, string> = {
  left: 'WEST',
  right: 'EAST',
  top: 'NORTH',
  bottom: 'SOUTH',
};

/** `undefined` for `auto`: the engine picks the port side. */
export function sideToElk(
  side: AdacConnectionSide | undefined
): string | undefined {
  if (!side || side === 'auto') return undefined;
  return ELK_SIDE[side];
}

// ── Ordering, position, packing ─────────────────────────────────────────────

export interface Placement {
  order?: number;
  position?: AdacLayoutPosition;
}

/** Splits `top-left` into its vertical/horizontal components. */
export function positionComponents(position: AdacLayoutPosition): {
  horizontal: 'start' | 'center' | 'end';
  vertical: 'start' | 'center' | 'end';
} {
  if (position === 'center')
    return { horizontal: 'center', vertical: 'center' };
  const [v, h] = position.split('-') as [string, string];
  const pick = (x: string, lo: string, hi: string) =>
    x === lo ? 'start' : x === hi ? 'end' : 'center';
  return {
    vertical: pick(v, 'top', 'bottom'),
    horizontal: pick(h, 'left', 'right'),
  };
}

/**
 * Deterministic sibling order: explicit `order` first (ascending), then
 * declaration index. Elements without `order` follow the ordered ones.
 */
export function sortByOrder<T>(
  items: T[],
  placementOf: (item: T) => Placement
): T[] {
  return items
    .map((item, index) => ({ item, index, order: placementOf(item).order }))
    .sort((a, b) => {
      const oa = a.order ?? Number.POSITIVE_INFINITY;
      const ob = b.order ?? Number.POSITIVE_INFINITY;
      if (oa !== ob) return oa < ob ? -1 : 1;
      return a.index - b.index;
    })
    .map((x) => x.item);
}

/**
 * Moves elements whose `position` asks for the start (`left` / `top`) or the
 * end (`right` / `bottom`) of `axis` to that side of the sequence. Everything
 * else keeps its relative order in the middle. Positions are screen regions,
 * so call this on the *visual* sequence (after any RL / BT reversal).
 */
export function partitionByPosition<T>(
  items: T[],
  placementOf: (item: T) => Placement,
  axis: Axis
): T[] {
  const bucket = (item: T): number => {
    const position = placementOf(item).position;
    if (!position) return 1;
    const side = positionComponents(position)[axis];
    return side === 'start' ? 0 : side === 'end' ? 2 : 1;
  };
  return items
    .map((item, index) => ({ item, index, b: bucket(item) }))
    .sort((x, y) => x.b - y.b || x.index - y.index)
    .map((x) => x.item);
}

/**
 * `FIRST`/`LAST` when `position` pins the element to the start or end of the
 * flow axis (e.g. `top-*` in a top-to-bottom diagram).
 */
export function layerConstraintFor(
  position: AdacLayoutPosition | undefined,
  flow: AdacLayoutDirection
): 'FIRST' | 'LAST' | undefined {
  if (!position) return undefined;
  const parts = positionComponents(position);
  const side = parts[axisOf(flow)];
  if (side === 'center') return undefined;
  const atStart = side === 'start';
  // Layers run left→right / top→bottom unless the flow is reversed.
  const first = isReversed(flow) ? !atStart : atStart;
  return first ? 'FIRST' : 'LAST';
}

/**
 * Splits items into lines. `exact` fills each line to `count`; `max` uses the
 * fewest lines that respect `count` and balances them (5 items, max 4 → 3+2).
 */
export function chunkIntoLines<T>(items: T[], limit?: LineLimit): T[][] {
  if (!limit || items.length === 0 || !(limit.count >= 1))
    return items.length ? [items] : [];
  const lineCount = Math.ceil(items.length / limit.count);
  const size =
    limit.kind === 'exact' ? limit.count : Math.ceil(items.length / lineCount);
  const lines: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    lines.push(items.slice(i, i + size));
  }
  return lines;
}

// ── Padding ─────────────────────────────────────────────────────────────────

export interface Box {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function mergePadding(
  base: Box,
  ...overrides: (PartialBox | undefined)[]
): Box {
  return overrides.reduce<Box>((acc, o) => ({ ...acc, ...(o ?? {}) }), base);
}

export function formatElkPadding(box: Box): string {
  return `[top=${box.top},left=${box.left},bottom=${box.bottom},right=${box.right}]`;
}
