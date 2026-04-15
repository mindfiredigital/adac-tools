# @mindfiredigital/adac-layout-dagre

Lightweight graph layout engine using Dagre for ADAC diagrams. Best for simple hierarchical architectures.

## Features

- 🚀 Lightweight and fast
- 📊 Hierarchical layout algorithm
- ⚡ Good for simple to medium diagrams (10-100 nodes)
- 🎯 Minimal dependencies

## Installation

```bash
npm install @mindfiredigital/adac-layout-dagre
pnpm add @mindfiredigital/adac-layout-dagre
```

## Usage

```typescript
import { layoutWithDagre } from '@mindfiredigital/adac-layout-dagre';

const graph = {
  nodes: [...],
  edges: [...],
};

const layout = await layoutWithDagre(graph);
console.log(layout.positions); // Node positions
```

## Configuration

```typescript
const options = {
  rankDir: 'TB', // TB (top-to-bottom), LR (left-to-right), etc.
  nodesep: 60,
  edgesep: 10,
};

const layout = await layoutWithDagre(graph, options);
```

## Performance

- Excellent for simple hierarchies
- Fast rendering (100ms for typical diagrams)
- Low memory footprint

## See Also

- [@mindfiredigital/adac-layout-elk](../layout-elk) - Professional alternative
- [@mindfiredigital/adac-layout-core](../layout-core) - Layout interfaces
- [@mindfiredigital/adac-core](../core) - Core integration

## License

MIT
