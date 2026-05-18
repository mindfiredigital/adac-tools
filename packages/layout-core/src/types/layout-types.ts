export type RankDir = 'TB' | 'LR';

export interface LayoutOptions {
  rankdir?: RankDir;
  nodesep?: number;
  ranksep?: number;
  marginx?: number;
  marginy?: number;
  edgeMargin?: number;
  maxIterations?: number;
  nodePlacementStrategy?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** @deprecated Use NodePosition instead */
export type PositionedNode = NodePosition;

export interface NodeData {
  width: number;
  height: number;
  [key: string]: unknown;
}

export interface EdgeData {
  [key: string]: unknown;
}

export interface EdgePath {
  points: Point[];
}

export interface LayoutResult {
  nodes: Record<string, NodePosition>;
  edges: Record<string, EdgePath>;
  bounds: { width: number; height: number };
}

export type RankMap = Map<string, number>;
export type OrderingMap = Map<number, string[]>;
