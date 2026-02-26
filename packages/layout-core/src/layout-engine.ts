// packages/adac-layout-core/src/layout-engine.ts

import { Graph } from './graph/graph';

import { detectCycles, breakCycles } from './algorithms/cycle-detection';

import { assignRanks } from './algorithms/rank-assignment';
import { orderNodes } from './algorithms/node-ordering';
import { assignCoordinates } from './algorithms/coordinate-assignment';
import { routeEdges } from './algorithms/edge-routing';

import { LayoutOptions, PositionedNode, EdgePath } from './types';

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
      nodesep: options.nodesep ?? 40,
      ranksep: options.ranksep ?? 50,
      marginx: options.marginx ?? 20,
      marginy: options.marginy ?? 20,
    };
  }

  /**
   * Add node
   */
  addNode(id: string, data: { width: number; height: number }) {
    this.graph.addNode(id, data);
  }

  /**
   * Add edge
   */
  addEdge(from: string, to: string) {
    this.graph.addEdge(from, to);
  }

  /**
   * Run layout pipeline
   */
  layout(): {
    nodes: Record<string, PositionedNode>;
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

    // 1️⃣ Detect & break cycles
    const cycles = detectCycles(this.graph);
    if (cycles.length > 0) {
      breakCycles(this.graph, cycles);
    }

    // 2️⃣ Assign ranks
    const ranks = assignRanks(this.graph);

    // 3️⃣ Order nodes
    const ordering = orderNodes(this.graph, ranks);

    // 4️⃣ Assign coordinates
    const positions = assignCoordinates(
      this.graph,
      ranks,
      ordering,
      this.options
    );

    // 5️⃣ Route edges
    const edgePaths = routeEdges(this.graph, positions, this.options);

    // 6️⃣ Calculate bounds
    const bounds = this.calculateBounds(positions);

    return {
      nodes: positions,
      edges: edgePaths,
      bounds,
    };
  }

  /**
   * Compute diagram bounds
   */
  private calculateBounds(positions: Record<string, PositionedNode>): {
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
