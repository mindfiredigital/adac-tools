# @mindfiredigital/adac-optimizer

Architecture optimization analysis for ADAC configurations. Automatically analyses your cloud infrastructure definition and produces prioritised, actionable recommendations across **cost**, **security**, **reliability**, and **architecture** categories.

> The optimizer runs **automatically** as part of every diagram generation pipeline — no extra setup required.

## Features

- 🔍 **Rule-based analysis** — 15+ built-in rules covering the most impactful cloud optimisation patterns
- 💰 **Cost rules** — Reserved Instance / Savings Plans opportunities, missing cost definitions, unmonitored high-cost services
- 🔒 **Security rules** — Encryption at rest, IAM roles, VPC placement, security group coverage
- 🛡️ **Reliability rules** — Multi-AZ deployment, auto-scaling policies, backup configuration, single-point-of-failure detection, orphaned service detection
- 🏗️ **Architecture rules** — Orphaned services with no connections
- ⚡ **Zero blocking** — Optimizer failures never prevent diagram generation
- 🎚️ **Filterable** — Filter by category, minimum severity, or disable rule groups entirely

## Installation

```bash
npm install @mindfiredigital/adac-optimizer
# or
pnpm add @mindfiredigital/adac-optimizer
```

## Quick Start

### Convenience function

```typescript
import { analyzeOptimizations } from '@mindfiredigital/adac-optimizer';
import { parseAdacFromContent } from '@mindfiredigital/adac-parser';
import fs from 'fs';

const yaml = fs.readFileSync('architecture.adac.yaml', 'utf-8');
const config = parseAdacFromContent(yaml);

const result = analyzeOptimizations(config);

console.log(`Found ${result.summary.total} recommendations:`);
console.log(`  Critical: ${result.summary.critical}`);
console.log(`  High:     ${result.summary.high}`);
console.log(`  Medium:   ${result.summary.medium}`);

for (const rec of result.recommendations) {
  console.log(`[${rec.severity.toUpperCase()}] ${rec.category}: ${rec.title}`);
  console.log(`  Affects: ${rec.affectedResources.join(', ')}`);
  for (const action of rec.actionItems) {
    console.log(`  → ${action}`);
  }
}
```

### `OptimizerEngine` class

```typescript
import { OptimizerEngine } from '@mindfiredigital/adac-optimizer';

const engine = new OptimizerEngine({
  // Only run cost and security rules
  categories: ['cost', 'security'],
  // Only show high/critical findings
  minSeverity: 'high',
  // Granular rule-group toggles
  enableCostRules: true,
  enableSecurityRules: true,
  enableReliabilityRules: false,
});

const result = engine.analyze(config);
```

## Automatic Integration

When using `@mindfiredigital/adac-core`, `@mindfiredigital/adac-diagram`, the VS Code extension, or the web server, the optimizer runs **automatically** with every diagram generation. You do not need to call it separately.

### CLI — diagram generation

```bash
# Optimizer runs automatically; summary appears in generation logs
adac diagram architecture.adac.yaml -o output.svg

# Disable optimizer analysis
adac diagram architecture.adac.yaml -o output.svg --no-optimize
```

### Core / npm module

```typescript
import { generateDiagramSvg } from '@mindfiredigital/adac-core';

// Optimizer included by default
const { svg, logs, optimizationResult } = await generateDiagramSvg(yaml, 'elk');

// Skip optimizer
const { svg } = await generateDiagramSvg(
  yaml,
  'elk',
  false,
  undefined,
  'monthly',
  true
);
```

### VS Code extension

The optimizer report appears as a collapsible **🔍 Optimizer** panel below every diagram preview, colour-coded by severity. Disable via VS Code settings:

```json
{
  "adac.diagram.optimize": false
}
```

### Web server — REST API

```bash
curl -X POST http://localhost:3000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "content": "<your ADAC YAML here>",
    "options": {
      "minSeverity": "high",
      "categories": ["cost", "security"]
    }
  }'
```

## API Reference

### `analyzeOptimizations(config, options?)`

Convenience wrapper. Equivalent to `new OptimizerEngine(options).analyze(config)`.

| Parameter | Type               | Description                   |
| --------- | ------------------ | ----------------------------- |
| `config`  | `AdacConfig`       | Parsed ADAC configuration     |
| `options` | `OptimizerOptions` | Optional rule filter settings |

Returns `OptimizationResult`.

---

### `OptimizerEngine`

```typescript
class OptimizerEngine {
  constructor(options?: OptimizerOptions);
  analyze(config: AdacConfig): OptimizationResult;
}
```

---

### `OptimizerOptions`

```typescript
interface OptimizerOptions {
  /** Only return recommendations for these categories (default: all) */
  categories?: OptimizationCategory[];
  /** Minimum severity to include (default: 'info') */
  minSeverity?: OptimizationSeverity;
  enableCostRules?: boolean; // default true
  enableSecurityRules?: boolean; // default true
  enableReliabilityRules?: boolean; // default true
}
```

---

### `OptimizationResult`

```typescript
interface OptimizationResult {
  /** All recommendations, sorted by severity (critical first) */
  recommendations: OptimizationRecommendation[];
  /** Recommendations grouped by the affected service ID */
  byService: Record<string, OptimizationRecommendation[]>;
  /** Aggregated counts */
  summary: OptimizationSummary;
  /** ISO-8601 timestamp */
  analyzedAt: string;
}
```

---

### `OptimizationRecommendation`

```typescript
interface OptimizationRecommendation {
  id: string;
  title: string;
  description: string;
  category:
    | 'cost'
    | 'performance'
    | 'reliability'
    | 'security'
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

### `OptimizationSummary`

```typescript
interface OptimizationSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
  totalEstimatedSavingsUsd: number;
}
```

## Built-in Rules

### Cost rules

| Rule                          | Severity | Trigger                                                |
| ----------------------------- | -------- | ------------------------------------------------------ |
| No cost definition            | `info`   | Service has no `cost:` block                           |
| Reserved Instance opportunity | `medium` | On-demand RI-eligible service (EC2, RDS, ElastiCache…) |
| Savings Plan opportunity      | `medium` | On-demand Fargate/Lambda/SageMaker                     |
| Managed service alternative   | `low`    | Self-managed where managed equivalent exists           |
| Unmonitored high-cost service | `high`   | High-cost service without `monitoring:` block          |

### Security rules

| Rule                              | Severity   | Trigger                                            |
| --------------------------------- | ---------- | -------------------------------------------------- |
| Encryption at rest not configured | `critical` | Sensitive data stores without `encrypted: true`    |
| IAM role not declared             | `high`     | Compute service without `iam_role:`                |
| Sensitive service not in VPC      | `critical` | Data stores without subnet/VPC configuration       |
| No security groups defined        | `high`     | Network-facing services without `security_groups:` |

### Reliability rules

| Rule                         | Severity | Trigger                                                   |
| ---------------------------- | -------- | --------------------------------------------------------- |
| Single-AZ deployment         | `high`   | Fewer than 2 `availability_zones:` entries                |
| No auto-scaling configured   | `medium` | Compute/data service without scaling policy               |
| Backup policy not configured | `high`   | Stateful service without `backup_retention_period:`       |
| Single point of failure      | `high`   | Compute tier without upstream load balancer and single AZ |
| Orphaned service             | `medium` | Service with no connections while others have connections |

## See Also

- [@mindfiredigital/adac-core](../core) — Core diagram generation (optimizer integrated)
- [@mindfiredigital/adac-compliance](../compliance) — Framework compliance checking
- [@mindfiredigital/adac-cost](../cost) — Cost breakdown analysis
- [@mindfiredigital/adac-diagram](../diagram) — CLI distribution

## License

MIT
