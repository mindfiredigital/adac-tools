import { CustomLayoutEngine } from '@mindfiredigital/adac-layout-core';
import type {
  EdgeData,
  LayoutEngine,
  LayoutOptions,
  LayoutResult,
  NodeData,
} from './interface';

/**
 * Adapter class to bridge the adac-layout-core CustomLayoutEngine to the layout module's LayoutEngine interface.
 */
export class CustomLayoutEngineAdapter implements LayoutEngine {
  private readonly engine: CustomLayoutEngine;

  /**
   * Initializes the adapter with the specified layout options.
   * @param options Configuration options to pass to the core custom engine.
   */
  constructor(options: LayoutOptions = {}) {
    this.engine = new CustomLayoutEngine(options);
  }

  /**
   * Adds a node to the layout engine graph.
   * @param id The unique identifier of the node.
   * @param data Node-specific data including width and height.
   */
  addNode(id: string, data: NodeData): void {
    this.engine.addNode(id, data);
  }

  /**
   * Adds an edge to the layout engine graph.
   * @param from The source node ID of the edge.
   * @param to The target node ID of the edge.
   * @param data Optional edge data (e.g., weights or labels).
   */
  addEdge(from: string, to: string, data?: EdgeData): void {
    this.engine.addEdge(from, to, data);
  }

  /**
   * Executes the layout algorithm on the constructed graph.
   * @returns The resulting positions for nodes and paths for edges.
   */
  layout(): LayoutResult {
    return this.engine.layout();
  }
}
