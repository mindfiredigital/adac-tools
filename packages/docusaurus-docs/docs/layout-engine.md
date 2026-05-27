# Layout Engine Package

## Introduction

`@mindfiredigital/adac-layout-engine` provides graph layout algorithms (ELK, Dagre) to calculate node/edge positions for ADAC diagrams.

## Installation

```bash
npm install @mindfiredigital/adac-layout-engine
# or
pnpm add @mindfiredigital/adac-layout-engine
```

## Usage

```ts
import { calculateLayout } from '@mindfiredigital/adac-layout-engine';

const layout = await calculateLayout({
  nodes: [...],
  edges: [...],
  engine: 'elk', // or 'dagre'
});
```

See the API reference for advanced options.
