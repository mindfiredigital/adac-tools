// ── Declarative layout & styling ────────────────────────────────────────────
// Lengths are logical units unless stated otherwise; they are resolved to
// pixels through `AdacLayoutOptions.unitSize`.

export type AdacLayoutDirection = 'LR' | 'RL' | 'TB' | 'BT';
export type AdacLayoutAlign = 'start' | 'center' | 'end';
export type AdacLayoutJustify =
  'start' | 'center' | 'end' | 'space-between' | 'space-around';
export type AdacEdgeRouting =
  'orthogonal' | 'polyline' | 'splines' | 'straight';
export type AdacConnectionSide = 'left' | 'right' | 'top' | 'bottom' | 'auto';
export type AdacLayoutPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type AdacGap = number | { horizontal?: number; vertical?: number };
export type AdacPadding =
  number | { top?: number; right?: number; bottom?: number; left?: number };
export type AdacDimension = number | 'auto';
export interface AdacSize {
  width?: AdacDimension;
  height?: AdacDimension;
}

/** Root-level layout defaults (`layoutOptions`). */
export interface AdacLayoutOptions {
  engine?: 'elk' | 'dagre' | 'custom';
  unitSize?: number;
  /** @deprecated use `unitSize` */
  unit?: number;
  direction?: AdacLayoutDirection;
  gap?: AdacGap;
  containerPadding?: AdacPadding;
  align?: AdacLayoutAlign;
  justify?: AdacLayoutJustify;
  edgeSpacing?: number;
  edgeRouting?: AdacEdgeRouting;
  /** @deprecated use `edgeRouting` */
  routing?: AdacEdgeRouting;
  background?: boolean;
  edgeLabels?: boolean;
  /** Most characters on one line of a node label; longer labels wrap, then truncate. */
  labelMaxChars?: number;
}

/**
 * `visual.layout`. `direction`, `gap`, `padding`, `align`, `justify`, `wrap`,
 * `*ItemsPerLine`, `size`, `minSize` and `maxSize` control the element's
 * direct children; `order` and `position` place the element in its parent.
 */
export interface AdacElementLayout {
  direction?: AdacLayoutDirection;
  gap?: AdacGap;
  padding?: AdacPadding;
  align?: AdacLayoutAlign;
  justify?: AdacLayoutJustify;
  wrap?: boolean;
  maxItemsPerLine?: number;
  itemsPerLine?: number;
  order?: number;
  position?: AdacLayoutPosition;
  size?: AdacSize;
  minSize?: AdacSize;
  maxSize?: AdacSize;
}

export interface AdacElementStyle {
  background?: boolean;
  /** Most characters on one line of this element's label. */
  labelMaxChars?: number;
}

export interface AdacConnectionLayout {
  fromSide?: AdacConnectionSide;
  toSide?: AdacConnectionSide;
  routing?: AdacEdgeRouting;
}

export interface AdacVisual {
  icon?: string;
  group?: string;
  description?: string;
  layout?: AdacElementLayout;
  style?: AdacElementStyle;
}

export interface AdacApplication {
  id: string;
  name: string;
  type: string;
  technology?: string;
  description?: string;
  owner?: string;
  repository?: string;
  sla?: {
    availability_percent?: number;
    max_latency_ms?: number;
    rto_minutes?: number;
    rpo_minutes?: number;
  };
  visual?: AdacVisual;
  annotations?: {
    icon?: string;
    group?: string;
    description?: string;
    tags?: string[];
  };
  insight_tags?: {
    icon?: string;
    group?: string;
    description?: string;
    tags?: string[];
  };
}

export interface AdacService {
  id: string;
  service: string;
  name?: string;
  description?: string;
  runs?: string[];
  configuration?: Record<string, unknown>;
  cost?: Record<string, unknown>;
  monitoring?: Record<string, unknown>;
  compliance?: string[];
  tags?: Record<string, string>;
  availability_zones?: string[];
  security_groups?: string[];
  subnets?: string[];
  iam_role?: string;

  visual?: AdacVisual;
  annotations?: {
    icon?: string;
    group?: string;
    description?: string;
    tags?: string[];
  };
  insight_tags?: {
    icon?: string;
    group?: string;
    description?: string;
    tags?: string[];
  };
  subtype?: string;
  type?: string;
  config?: Record<string, unknown>;
}

export interface AdacCloud {
  id: string;
  provider: 'aws' | 'gcp' | 'azure' | string;
  region: string;
  account_id?: string;
  project_id?: string;
  vpc_id?: string;
  tier?: string;
  services: AdacService[];
}

export interface GcpService {
  id: string;
  service: string;
  name?: string;
  description?: string;
  runs?: string[];
  configuration?: Record<string, unknown>;
  config?: Record<string, unknown>;
  cost?: Record<string, unknown>;
  monitoring?: Record<string, unknown>;
  compliance?: string[];
  tags?: Record<string, string>;
  zone?: string;
  region?: string;
  project?: string;
  visual?: AdacVisual;
  annotations?: {
    icon?: string;
    group?: string;
    description?: string;
    tags?: string[];
  };
  insight_tags?: {
    icon?: string;
    group?: string;
    description?: string;
    tags?: string[];
  };
  subtype?: string;
  type?: string;
}

export interface AdacConnection {
  id: string;
  from: string;
  to: string;
  source?: string;
  target?: string;
  type: string;
  bidirectional?: boolean;
  layout?: AdacConnectionLayout;
}

export interface AdacConfig {
  version: '0.1' | '0.2';
  metadata: {
    name: string;
    created: string;
    description?: string;
    author?: string;
    version?: string;
    updated?: string;
    organization?: string;
    tags?: string[];
    environment?: 'development' | 'staging' | 'production' | 'test' | 'demo';
  };
  applications?: AdacApplication[];
  infrastructure: {
    clouds: AdacCloud[];
  };
  connections?: AdacConnection[];
  cost?: Record<string, unknown>;
  layout?: 'elk' | 'dagre';
  layoutOptions?: AdacLayoutOptions;
}
