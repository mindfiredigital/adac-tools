# @mindfiredigital/adac-layout-elk

Professional graph layout engine using ELK (Eclipse Layout Kernel) for ADAC diagrams. Best for complex architectures.

## Features

- 🎨 Professional hierarchical graph layout
- 🏗️ Multi-level layout algorithm
- ⚡ Optimized for complex diagrams (100+ nodes)
- 🎯 Configurable layout options

## Installation

```bash
npm install @mindfiredigital/adac-layout-elk
pnpm add @mindfiredigital/adac-layout-elk
```

## Usage

```typescript
import { layoutWithELK } from '@mindfiredigital/adac-layout-elk';

const graph = {
  nodes: [...],
  edges: [...],
};

const layout = await layoutWithELK(graph);
console.log(layout.positions); // Node positions
```

## Configuration

```typescript
const options = {
  direction: 'DOWN', // DOWN, RIGHT, UP, LEFT
  spacing: 100,
  hierarchyHandling: 'INCLUDE_CHILDREN',
};

const layout = await layoutWithELK(graph, options);
```

## Performance

- Optimal for diagrams with 50-500+ nodes
- Handles complex hierarchies
- Configurable for performance tuning

## See Also

- [@mindfiredigital/adac-layout-dagre](../layout-dagre) - Lightweight alternative
- [@mindfiredigital/adac-layout-core](../layout-core) - Layout interfaces
- [@mindfiredigital/adac-core](../core) - Core integration

## License

MIT
