import { CustomLayoutEngine } from '@mindfiredigital/adac-layout-core';
import type {
  EdgeData,
  LayoutEngine,
  LayoutOptions,
  LayoutResult,
  NodeData,
} from './interface';

export class CustomLayoutEngineAdapter implements LayoutEngine {
  private readonly engine: CustomLayoutEngine;

  constructor(options: LayoutOptions = {}) {
    this.engine = new CustomLayoutEngine(options);
  }

  addNode(id: string, data: NodeData): void {
    this.engine.addNode(id, data);
  }

  addEdge(from: string, to: string, _data?: EdgeData): void {
    this.engine.addEdge(from, to);
  }

  layout(): LayoutResult {
    return this.engine.layout();
  }
}
