# ADAC Tools - API Reference

## Overview

This document outlines the API surface for core ADAC packages.

## Core Packages

### Schema (`@mindfiredigital/adac-schema`)

Defines the core data models for cloud architecture.

#### `AdacConfig`

The root object for an architecture definition.

- `version`: ADAC specification version (e.g., "0.1", "1.0")
- `metadata`: Name, author, creation date, etc.
- `applications`: Array of `AdacApplication`
- `infrastructure`: Object containing `clouds`
- `connections`: Array of `AdacConnection`

#### `AdacApplication`

- `id`: Unique identifier
- `name`: Display name
- `type`: frontend, backend, database, etc.
- `ai_tags`: (Optional) AI-generated hints for icons and grouping.

#### `AdacService` (AWS)

- `id`: Unique identifier
- `service`: AWS service identifier (e.g., "ec2", "s3")
- `type`: (Optional) Generic category
- `subtype`: (Optional) Specific service type
- `config`: (Optional) Raw configuration object
- `runs`: (Optional) IDs of applications running on this service

### Parser (`@mindfiredigital/adac-parser`)

- `parseAdac(filePath: string, options?: ParseOptions): AdacConfig`
- `parseAdacFromContent(content: string, options?: ParseOptions): AdacConfig`

**ParseOptions**:

- `validate`: (Boolean) Whether to validate against schema (default: `true`).

### Layouts

- **ELK** (`@mindfiredigital/adac-layout-elk`):
  - `buildElkGraph(adac: AdacConfig): ElkNode`

### Diagram (`@mindfiredigital/adac-diagram`)

- `generateDiagram(inputPath: string, outputPath: string, layout: 'elk' | 'dagre', validate: boolean): Promise<void>`

### CLI

- `adac diagram <file>`: Generate SVG.
- `adac validate <file>`: Validate YAML against schema.
