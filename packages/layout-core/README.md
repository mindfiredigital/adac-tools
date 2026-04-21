# @mindfiredigital/adac-layout-core

Core types and interfaces for graph layout engines in ADAC. Provides the contract that all layout engines must implement.

## Features

- 📋 Defines layout engine interface
- 🔧 Common types for graph structures
- 📐 Layout configuration types
- 🎨 Position and dimension types

## Installation

```bash
npm install @mindfiredigital/adac-layout-core
pnpm add @mindfiredigital/adac-layout-core
```

## Core Types

```typescript
import {
  DiagramNode,
  DiagramEdge,
  Graph,
  LayoutEngine,
  LayoutOptions,
  LayoutResult,
} from '@mindfiredigital/adac-layout-core';

// Define a layout engine
class MyLayoutEngine implements LayoutEngine {
  async layout(graph: Graph, options?: LayoutOptions): Promise<LayoutResult> {
    // Implementation
  }
}
```

## Graph Structure

```typescript
interface DiagramNode {
  id: string;
  label: string;
  width?: number;
  height?: number;
  type?: string;
}

interface DiagramEdge {
  source: string;
  target: string;
  label?: string;
}

interface Graph {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}
```

## Layout Result

```typescript
interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  dimensions: Map<string, { width: number; height: number }>;
}
```

## See Also

- [@mindfiredigital/adac-layout](../layout) - Layout orchestration
- [@mindfiredigital/adac-layout-elk](../layout-elk) - ELK implementation
- [@mindfiredigital/adac-layout-dagre](../layout-dagre) - Dagre implementation

## License

MIT
