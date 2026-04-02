// Common engine interface used by all layout engines

export interface NodeData {
  width: number;
  height: number;
  [key: string]: unknown;
}

export interface EdgeData {
  [key: string]: unknown;
}

export interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EdgePath {
  points: { x: number; y: number }[];
}

export interface Bounds {
  width: number;
  height: number;
}

export interface LayoutResult {
  nodes: Record<string, NodePosition>;
  edges: Record<string, EdgePath>;
  bounds: Bounds;
}

export interface LayoutOptions {
  rankdir?: 'TB' | 'LR';
  nodesep?: number;
  ranksep?: number;
  marginx?: number;
  marginy?: number;
}

export interface LayoutEngine {
  addNode(id: string, data: NodeData): void;
  addEdge(from: string, to: string, data?: EdgeData): void;
  layout(): LayoutResult | Promise<LayoutResult>;
}
