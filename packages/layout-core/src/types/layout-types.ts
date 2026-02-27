export type RankDir = 'TB' | 'LR';

export interface LayoutOptions {
  rankdir?: RankDir;
  nodesep?: number;
  ranksep?: number;
  marginx?: number;
  marginy?: number;
}

export interface PositionedNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EdgePath {
  points: { x: number; y: number }[];
}

export type RankMap = Map<string, number>;
export type OrderingMap = Map<number, string[]>;
