// packages/adac-layout-core/src/index.ts

// ============================================
// PRIMARY EXPORT
// ============================================

export { CustomLayoutEngine } from './layout-engine';

// ============================================
// GRAPH STRUCTURES
// ============================================

export { Graph } from './graph/graph';
export { Node } from './graph/node';
export { Edge } from './graph/edge';

// ============================================
// ALGORITHMS (optional advanced usage)
// ============================================

export { detectCycles, breakCycles } from './algorithms/cycle-detection';

export { assignRanks } from './algorithms/rank-assignment';
export { orderNodes } from './algorithms/node-ordering';
export { assignCoordinates } from './algorithms/coordinate-assignment';
export { routeEdges } from './algorithms/edge-routing';

// ============================================
// TYPES
// ============================================

export type {
  LayoutOptions,
  RankDir,
  PositionedNode,
  EdgePath,
  RankMap,
  OrderingMap,
} from './types';
