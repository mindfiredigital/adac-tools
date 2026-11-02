# @mindfiredigital/adac-layout

Layout orchestration for ADAC diagrams. Provides a unified interface for different layout engines.

## Features

- 🎯 Unified layout orchestration API
- 🔀 Multiple layout engine support (ELK)
- ⚡ Automatic engine selection based on diagram complexity
- 🎨 Consistent layout output across engines

## Installation

> **Note:** This is an internal workspace package and is **not** distributed as a standalone npm module. It is intended to be used within the ADAC monorepo.

To use it in another workspace package, add it to your `package.json`:

```json
{
  "dependencies": {
    "@mindfiredigital/adac-layout": "workspace:*"
  }
}
```

## Usage

```typescript
import { createLayout } from '@mindfiredigital/adac-layout';

const graph = {
  nodes: [...],
  edges: [...],
};

const layout = await createLayout(graph);
console.log(layout.positions); // Node positions
```

## Supported Layout Engines

- **ELK**: Professional hierarchical layout for complex diagrams (50-500+ nodes)

## Configuration

```typescript
const options = {
  engine: 'elk', // 'elk' or 'custom'
  direction: 'DOWN', // DOWN, RIGHT, UP, LEFT
  spacing: 100,
};

const layout = await createLayout(graph, options);
```

## See Also

- [@mindfiredigital/adac-layout-core](../layout-core) - Core types and interfaces
- [@mindfiredigital/adac-layout-elk](../layout-elk) - ELK layout engine

- [@mindfiredigital/adac-diagram](../diagram) - Diagram generator using this layout

## License

MIT
