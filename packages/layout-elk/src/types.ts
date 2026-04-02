export interface ElkNode {
  id: string;
  width?: number;
  height?: number;
  labels?: { text: string }[];
  children?: ElkNode[];
  edges?: ElkEdge[];
  layoutOptions?: Record<string, string>;
  x?: number;
  y?: number;
  // Visual properties
  properties?: {
    type?: string;
    iconPath?: string;
    description?: string;
    cssClass?: string;
    title?: string;
  };
}

export interface ElkEdge {
  id: string;
  sources: string[];
  targets: string[];
  container?: string;
  labels?: { text: string }[];
  sections?: {
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
    bendPoints?: { x: number; y: number }[];
  }[];
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
}

export interface LayoutEngine {
  addNode(id: string, data: LayoutNodeData): void;
  addEdge(from: string, to: string, data?: LayoutEdgeData): void;
  layout(): LayoutResult | Promise<LayoutResult>;
}
