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
