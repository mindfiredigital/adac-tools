# @mindfiredigital/adac-layout-core

Core types and interfaces for graph layout engines in ADAC. Provides the contract that all layout engines must implement.

## Features

- 📐 **Layered Graph Layout**: High-performance implementation of the Sugiyama framework.
- 🎨 **Crossing Reduction**: Robust Barycenter heuristic for clean, readable diagrams.
- 📐 **Balanced Positioning**: Symmetrical node placement for professional aesthetics.
- 🛣️ **Smart Edge Routing**: Polyline routing with support for multi-layer spans.
- 📋 **Common Types**: Shared contract for all layout engines.

## Installation

> **Note:** This is an internal workspace package and is **not** distributed as a standalone npm module. It is intended to be used within the ADAC monorepo.

To use it in another workspace package, add it to your `package.json`:

```json
{
  "dependencies": {
    "@mindfiredigital/adac-layout-core": "workspace:*"
  }
}
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

## Performance Tuning

The default custom layout settings favor readable spacing and crossing
reduction. For large or latency-sensitive graphs, lower the spacing and
iteration options when constructing the layout engine:

```typescript
const engine = new CustomLayoutEngine({
  nodesep: 80,
  ranksep: 100,
  maxIterations: 24,
  edgeRoutingMaxAttempts: 10,
});
```

## See Also

- [@mindfiredigital/adac-layout](../layout) - Layout orchestration
- [@mindfiredigital/adac-layout-elk](../layout-elk) - ELK implementation

## License

MIT
