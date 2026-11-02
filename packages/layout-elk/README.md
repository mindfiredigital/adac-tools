# @mindfiredigital/adac-layout-elk

Professional graph layout engine using ELK (Eclipse Layout Kernel) for ADAC diagrams. Best for complex architectures.

## Features

- 🎨 Professional hierarchical graph layout
- 🏗️ Multi-level layout algorithm
- ⚡ Optimized for complex diagrams (100+ nodes)
- 🎯 Configurable layout options

## Installation

> **Note:** This is an internal workspace package and is **not** distributed as a standalone npm module. It is intended to be used within the ADAC monorepo.

To use it in another workspace package, add it to your `package.json`:

```json
{
  "dependencies": {
    "@mindfiredigital/adac-layout-elk": "workspace:*"
  }
}
```

## Run Standalone

This package exposes the `adac-layout-elk` binary inside the workspace. It
parses an ADAC YAML file and writes the generated ELK graph JSON.

From the monorepo root:

```bash
pnpm --filter @mindfiredigital/adac-layout-elk build
node packages/layout-elk/dist/cli.js yamls/aws.adac.yaml --output ./elk-graph.json
```

If `--output` is omitted, the ELK graph JSON is printed to stdout.

## Programmatic Usage

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

- [@mindfiredigital/adac-layout-core](../layout-core) - Layout interfaces
- [@mindfiredigital/adac-core](../core) - Core integration

## License

MIT
