# ADAC Tools - API Reference

## Overview
This document outlines the API surface for core ADAC packages, aligning with Issue #4.

## Core Packages

### Schema (`@mindfiredigital/adac-schema`)
Defines the core data models:
- `AdacConfig`
- `AdacInfrastructure` (Clouds, Services)
- `AdacApplication`
- `AdacLayout`

### Parser (`@mindfiredigital/adac-parser`)
- `parseAdac(yaml: string): AdacConfig`
- `parseAdacFromContent(content: string): AdacConfig`

### Layouts
- **Core** (`@mindfiredigital/adac-layout-core`): Shared interfaces.
- **ELK** (`@mindfiredigital/adac-layout-elk`):
  - `buildElkGraph(adac: AdacConfig): ElkNode`
- **Dagre** (`@mindfiredigital/adac-layout-dagre`):
  - `layoutDagre(graph: ElkNode): ElkNode`

### Diagram (`@mindfiredigital/adac-diagram`)
- `generateDiagramSvg(content: string, layout: string): Promise<GenerationResult>`
- `renderSvg(graph: ElkNode, layoutEngine: string): string`

### CLI (`@mindfiredigital/adac-cli`)
- Command: `adac diagram <file> [options]`
  - `-l, --layout`: `elk` | `dagre`
  - `-o, --output`: Output file path
