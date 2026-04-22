# ADAC Tools - API Reference

## Overview

This document outlines the API surface for core ADAC packages.

---

## Core Packages

### Schema (`@mindfiredigital/adac-schema`)

Defines the core data models for cloud architecture.

#### `AdacConfig`

The root object for an architecture definition.

- `version`: ADAC specification version (e.g., `"0.1"`)
- `metadata`: Name, author, creation date, etc.
- `infrastructure`: Object containing `clouds[]`
- `connections`: Array of `AdacConnection`

#### `AdacService`

- `id`: Unique identifier
- `service`: Cloud service identifier (e.g., `"ec2"`, `"rds-postgres"`)
- `cost`: Optional cost block (`monthly_usd`, `billing_model`)
- `configuration`: Optional raw configuration object
- `iam_role`, `security_groups`, `subnets`, `availability_zones`, `monitoring`: Optional fields used by optimizer rules

---

### Parser (`@mindfiredigital/adac-parser`)

- `parseAdac(filePath, options?): AdacConfig`
- `parseAdacFromContent(content, options?): AdacConfig`

**ParseOptions**: `validate` (boolean, default `true`)

---

### Layouts

- **ELK** (`@mindfiredigital/adac-layout-elk`): `buildElkGraph(adac): ElkNode`
- **Dagre** (`@mindfiredigital/adac-layout-dagre`): `layoutDagre(graph): Promise<ElkNode>`

---

### Core (`@mindfiredigital/adac-core`)

#### `generateDiagramSvg(yaml, layoutEngine?, validate?, costData?, period?, skipOptimizer?)`

Generates an SVG diagram from YAML content. Runs compliance checks and the architecture optimizer automatically.

| Parameter       | Type                     | Default     | Description                   |
| --------------- | ------------------------ | ----------- | ----------------------------- |
| `yaml`          | `string`                 | —           | ADAC YAML content             |
| `layoutEngine`  | `'elk' \| 'dagre'`       | `'elk'`     | Graph layout algorithm        |
| `validate`      | `boolean`                | `false`     | Validate schema before layout |
| `costData`      | `Record<string, number>` | —           | Per-service cost overrides    |
| `period`        | `string`                 | `'monthly'` | Cost display period           |
| `skipOptimizer` | `boolean`                | `false`     | Skip optimization analysis    |

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
  -l, --layout <type>     elk | dagre (default: elk)
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

### Optimizer (`@mindfiredigital/adac-optimizer`)

Automatic architecture analysis that surfaces cost, security, and reliability improvements. Runs as part of every diagram generation pipeline.

#### `analyzeOptimizations(config, options?)`

Convenience wrapper around `OptimizerEngine`.

```typescript
import { analyzeOptimizations } from '@mindfiredigital/adac-optimizer';

const result = analyzeOptimizations(config, {
  categories: ['cost', 'security'],
  minSeverity: 'high',
});
```

#### `OptimizerEngine`

```typescript
const engine = new OptimizerEngine({
  categories?: OptimizationCategory[];    // Default: all
  minSeverity?: OptimizationSeverity;     // Default: 'info'
  enableCostRules?: boolean;              // Default: true
  enableSecurityRules?: boolean;          // Default: true
  enableReliabilityRules?: boolean;       // Default: true
});

const result: OptimizationResult = engine.analyze(config);
```

#### `OptimizationResult`

```typescript
interface OptimizationResult {
  recommendations: OptimizationRecommendation[]; // Sorted: critical first
  byService: Record<string, OptimizationRecommendation[]>;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
    totalEstimatedSavingsUsd: number;
  };
  analyzedAt: string; // ISO-8601
}
```

#### `OptimizationRecommendation`

```typescript
interface OptimizationRecommendation {
  id: string;
  title: string;
  description: string;
  category:
    | 'cost'
    | 'security'
    | 'reliability'
    | 'performance'
    | 'scalability'
    | 'architecture';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  affectedResources: string[];
  estimatedSavingsUsd?: number;
  actionItems: string[];
  referenceUrl?: string;
}
```

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
