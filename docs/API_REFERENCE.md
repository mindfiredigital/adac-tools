# ADAC Tools - API Reference

## Overview

This document outlines the API surface for core ADAC packages.

---

## Core Packages

### Parser (`@mindfiredigital/adac-parser`)

- `parseAdac(filePath, options?): AdacConfig`
- `parseAdacFromContent(content, options?): AdacConfig`

**ParseOptions**: `validate` (boolean, default `true`)

---

### Layouts

- **ELK** (`@mindfiredigital/adac-layout-elk`): `buildElkGraph(adac): ElkNode`

---

### Core (`@mindfiredigital/adac-core`)

#### `generateDiagramSvg(yaml, layoutEngine?, validate?, costData?, period?, skipOptimizer?)`

Generates an SVG diagram from YAML content. Runs compliance checks and the architecture optimizer automatically.

| Parameter       | Type                                         | Default     | Description                   |
| --------------- | -------------------------------------------- | ----------- | ----------------------------- |
| `yaml`          | `string`                                     | —           | ADAC YAML content             |
| `layoutEngine`  | `'elk' \| 'custom' \| 'orthogonal' \| 'tsm'` | `'custom'`  | Graph layout algorithm        |
| `validate`      | `boolean`                                    | `false`     | Validate schema before layout |
| `costData`      | `Record<string, number>`                     | —           | Per-service cost overrides    |
| `period`        | `string`                                     | `'monthly'` | Cost display period           |
| `skipOptimizer` | `boolean`                                    | `false`     | Skip optimization analysis    |

**Returns:** `Promise<GenerationResult>`

```typescript
interface GenerationResult {
  svg: string;
  logs: string[];
  duration: number;
  optimizationResult?: OptimizationResult; // undefined if skipOptimizer=true
}
```

#### `generateDiagram(input, output, layout?, validate?, costData?, period?, skipOptimizer?)`

File-based wrapper. Reads YAML from `input` and writes SVG to `output`.

---

### Diagram (`@mindfiredigital/adac-diagram`)

- `generateDiagram(inputPath, outputPath, layout?, validate?, costData?, period?, skipOptimizer?)`
- `generateDiagramSvg(content, layout?, validate?, costData?, period?, skipOptimizer?)`

---

### CLI (`@mindfiredigital/adac-cli` / `adac` binary)

```
adac diagram <file>   Generate SVG diagram
  -l, --layout <type>     elk | custom | orthogonal | tsm (default: custom)
  -o, --output <path>     Output SVG path
  --validate              Run schema validation
  --cost                  Print cost breakdown
  --pricing <model>       on_demand | reserved
  --period <period>       hourly | daily | monthly | yearly
  --no-optimize           Skip architecture optimization analysis

adac validate <file>  Validate YAML against schema
adac cost <file>      Print cost breakdown only
adac terraform <file> Generate Terraform files
```

> Note: Compliance is handled automatically based on `compliance: […]` fields on individual services. The optimizer runs automatically unless `--no-optimize` is set.

---

### Compliance (`@mindfiredigital/adac-compliance`)

```typescript
const checker = new ComplianceChecker();
const { byService, results, remediationPlan } = checker.checkCompliance(config);
```

- `byService`: `{ [serviceId]: ComplianceResult[] }`
- `results`: Flat array of all evaluations
- `remediationPlan`: Deduplicated remediation steps

---

### Web Server (`@mindfiredigital/adac-web-server`)

All responses are **gzip/brotli compressed**. All endpoints accept and return JSON.

| Method | Path                    | Description                        |
| ------ | ----------------------- | ---------------------------------- |
| `POST` | `/api/generate`         | Generate SVG diagram               |
| `POST` | `/api/compliance-check` | Run compliance checks              |
| `POST` | `/api/cost`             | Cost breakdown                     |
| `POST` | `/api/optimize`         | Architecture optimization analysis |

#### `POST /api/generate`

```json
// Request
{ "content": "<ADAC YAML>", "layout": "elk" }

// Response 200
{ "svg": "…", "logs": ["…"], "duration": 312, "optimizationResult": { … } }
```

#### `POST /api/optimize`

```json
// Request
{
  "content": "<ADAC YAML>",
  "options": {
    "categories": ["cost", "security"],
    "minSeverity": "high"
  }
}

// Response 200
{
  "recommendations": [ … ],
  "byService": { … },
  "summary": { "critical": 1, "high": 2, "total": 3, … },
  "analyzedAt": "2026-04-22T06:15:00.000Z"
}
```
