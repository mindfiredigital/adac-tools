// packages/adac-layout-core/src/layout-engine.ts

import { Graph } from './graph/graph';

import { detectCycles, breakCycles } from './algorithms/cycle-detection';

import { assignRanks, normalize } from './algorithms/rank-assignment';
import { orderNodes } from './algorithms/node-ordering';
import { assignCoordinates } from './algorithms/coordinate-assignment';
import { routeEdges } from './algorithms/edge-routing';

import {
  LayoutOptions,
  NodePosition,
  EdgePath,
  NodeData,
  EdgeData,
} from './types';

/**
 * CustomLayoutEngine
 *
 * Minimal layered layout engine.
 */
export class CustomLayoutEngine {
  private graph: Graph;

  private options: Required<LayoutOptions>;

  constructor(options: LayoutOptions = {}) {
    this.graph = new Graph();

    this.options = {
      rankdir: options.rankdir ?? 'TB',
      nodesep: options.nodesep ?? 80,
      ranksep: options.ranksep ?? 100,
      marginx: options.marginx ?? 40,
      marginy: options.marginy ?? 40,
      edgeMargin: options.edgeMargin ?? 12,
    };
  }

  /**
   * Add node
   */
  addNode(id: string, data: NodeData) {
    this.graph.addNode(id, data);
  }

  /**
   * Add edge
   */
  addEdge(from: string, to: string, data?: EdgeData) {
    this.graph.addEdge(from, to, data);
  }

  /**
   * Run layout pipeline
   */
  layout(): {
    nodes: Record<string, NodePosition>;
    edges: Record<string, EdgePath>;
    bounds: { width: number; height: number };
  } {
    if (this.graph.nodeCount() === 0) {
      return {
        nodes: {},
        edges: {},
        bounds: { width: 0, height: 0 },
      };
    }

    // 1. Detect & break cycles
    const cycles = detectCycles(this.graph);
    if (cycles.length > 0) {
      breakCycles(this.graph, cycles);
    }

    // 2. Assign ranks
    assignRanks(this.graph);

    // 3. Normalize (insert virtual nodes)
    normalize(this.graph);

    // Re-collect ranks from nodes as normalization adds new nodes
    const ranks: Map<string, number> = new Map();
    this.graph.nodes.forEach((node, id) => {
      ranks.set(id, node.rank);
    });

    // 4. Order nodes
    const ordering = orderNodes(this.graph, ranks);

    // 5. Assign coordinates
    const positions = assignCoordinates(
      this.graph,
      ranks,
      ordering,
      this.options
    );

    // 6. Route edges
    const edgePaths = routeEdges(this.graph, positions, this.options);

    // 7. Calculate bounds
    const bounds = this.calculateBounds(positions);

    // 8. Filter results (remove virtual nodes from node positions)
    const finalNodes: Record<string, NodePosition> = {};
    Object.entries(positions).forEach(([id, pos]) => {
      if (!this.graph.getNode(id)?.isVirtual) {
        finalNodes[id] = pos;
      }
    });

    return {
      nodes: finalNodes,
      edges: edgePaths,
      bounds,
    };
  }

  /**
   * Compute diagram bounds
   */
  private calculateBounds(positions: Record<string, NodePosition>): {
    width: number;
    height: number;
  } {
    let maxX = 0;
    let maxY = 0;

    Object.values(positions).forEach((node) => {
      const right = node.x + node.width;
      const bottom = node.y + node.height;

      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    });

    return {
      width: maxX + this.options.marginx,
      height: maxY + this.options.marginy,
    };
  }
}
