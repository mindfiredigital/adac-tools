import type {
  ElkNode as BaseElkNode,
  ElkExtendedEdge,
  ElkEdgeSection as BaseElkEdgeSection,
} from 'elkjs';

export interface ElkNode extends BaseElkNode {
  id: string;
  width?: number;
  height?: number;
  labels?: { text: string }[];
  children?: ElkNode[];
  edges?: ElkEdge[];
  layoutOptions?: Record<string, string>;
  x?: number;
  y?: number;
  // Visual properties used by renderer
  properties?: {
    type?: string;
    iconPath?: string;
    description?: string;
    cssClass?: string;
    title?: string;
    insight_tags?: string[];
    /** Resolved `visual.style.background` (falls back to the global default). */
    background?: boolean;
    /** Resolved most characters on one line of the label. */
    labelMaxChars?: number;
    /** Declared `maxSize` in pixels; ELK cannot enforce it, so it is checked after layout. */
    maxSize?: { width?: number; height?: number };
    /** Child arrangement that is realised after layout (align / justify). */
    arrangement?: ElkArrangement;
    /**
     * The children are stacked along this axis inside a single ELK layer,
     * where ELK does not honour their declared order; post-layout restores it.
     */
    stackAxis?: 'horizontal' | 'vertical';
    /**
     * Connections between items of one arranged container that must not take
     * part in layering (it would stagger wrapped lines). They are routed after
     * layout and moved into `edges`.
     */
    deferredEdges?: ElkEdge[];
  };
}

/** Post-layout child arrangement of a container (see post-layout.ts). */
export interface ElkArrangement {
  mainAxis: 'horizontal' | 'vertical';
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  padding: { top: number; right: number; bottom: number; left: number };
  /** Align against the extent of the items themselves, not the container's inner box. */
  fitToItems?: boolean;
}

export interface ElkEdge extends ElkExtendedEdge {
  id: string;
  sources: string[];
  targets: string[];
  container?: string;
  labels?: { text: string }[];
  sections?: ElkEdgeSection[];
  properties?: {
    /** Invisible edge that only exists to steer the layout; never rendered. */
    layoutOnly?: boolean;
    /** Draw arrowheads on both ends. */
    bidirectional?: boolean;
    /** Per-connection routing override. */
    routing?: 'orthogonal' | 'polyline' | 'splines' | 'straight';
  };
}

export interface ElkEdgeSection extends BaseElkEdgeSection {
  id: string;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  bendPoints?: { x: number; y: number }[];
}

export interface LayoutNodeData {
  width: number;
  height: number;
  parent?: string;
  [key: string]: unknown;
}

export interface LayoutEdgeData {
  label?: string;
  [key: string]: unknown;
}

export interface LayoutNodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutEdgePath {
  points: { x: number; y: number }[];
}

export interface LayoutBounds {
  width: number;
  height: number;
}

export interface LayoutResult {
  nodes: Record<string, LayoutNodePosition>;
  edges: Record<string, LayoutEdgePath>;
  bounds: LayoutBounds;
}

export interface LayoutOptions {
  rankdir?: 'TB' | 'LR';
  nodesep?: number;
  ranksep?: number;
  marginx?: number;
  marginy?: number;
  edgeMargin?: number;
  maxIterations?: number;
  nodePlacementStrategy?: string;
}

export interface LayoutEngine {
  addNode(id: string, data: LayoutNodeData): void;
  addEdge(from: string, to: string, data?: LayoutEdgeData): void;
  layout(): LayoutResult | Promise<LayoutResult>;
}
