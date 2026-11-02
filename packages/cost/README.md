# @mindfiredigital/adac-cost

A modular AWS cost calculator engine for ADAC. Estimates monthly cloud costs using AWS pricing data, with optional breakdowns by service and category.

## Features

- Cost calculator engine (TypeScript)
- Embedded AWS pricing data (JSON snapshot)
- Monthly cost estimates
- Cost breakdowns by service and category (when enabled in the calculator)
- Supports multiple service groups:
  - Compute (EC2, ECS, Lambda)
  - Database (RDS, DynamoDB)
  - Storage (S3, EBS)
  - Networking (ALB, data transfer)
- Extensible for new services and providers
- **Dynamic Service Mapping**: Automatically recognizes services by the standard `service` field in YAML or explicit `type`/`subtype` declarations.
- **Diagram Integration**: Calculated costs are automatically embedded as tooltips in generated architecture diagrams.
- **Cost Validation Wrapper**: Provides cost-aware ADAC validation without coupling the generic validator package to cost rules.

## File Structure

```text
packages/cost/
  src/
    index.ts
    calculator.ts               # CostCalculator class
    validation.ts               # Cost validation wrapper for ADAC configs
    pricing/
      aws-pricing.ts            # AWS pricing helper
      pricing-data.json         # Compressed pricing data snapshot
    calculators/
      compute-calculator.ts     # EC2 / compute services
      database-calculator.ts    # RDS / database services
      storage-calculator.ts     # S3, EBS, etc.
      networking-calculator.ts  # ALB, data transfer
    types/
      index.ts
      cost-types.ts
  __tests__/
    calculator.test.ts
    calculator.integration.test.ts
    calculators/
      compute-calculator.test.ts
  package.json
  tsconfig.json
  README.md
```

## Run Standalone

This package exposes the `adac-cost` binary.

After installing the package:

```bash
adac-cost architecture.adac.yaml --period monthly --pricing on_demand
```

From the monorepo root:

```bash
pnpm --filter @mindfiredigital/adac-cost build
node packages/cost/dist/cli.js yamls/aws.adac.yaml --period yearly --pricing reserved
```

The command prints the total estimate plus compute, database, storage, and
networking breakdowns.

## Cost-aware Validation

The generic `@mindfiredigital/adac-validator` package validates the core ADAC
schema only. Use this package when your ADAC files include `cost` fields:

```typescript
import { validateAdacCostConfig } from '@mindfiredigital/adac-cost';

const result = validateAdacCostConfig(config);

if (!result.valid) {
  console.error(result.errors);
}
```

The wrapper validates the same cost fields that used to live in the generic
validator, including service-level `cost` and top-level cost summaries.

## CLI integration (diagram + cost)

The cost engine is typically used through the **diagram CLI** provided by `@mindfiredigital/adac-diagram`.
From the monorepo root you can render diagrams **with cost annotations**:

```bash
# Kubernetes example (yearly, on‑demand pricing)
pnpm cli diagram .\yamls\kubernetes.adac.yaml -o test.svg --cost --period yearly --pricing on_demand

# Data pipeline example (yearly, on‑demand pricing)
pnpm cli diagram .\yamls\data_pipeline.adac.yaml -o test.svg --cost --period yearly --pricing on_demand
```

Flags:

- `--cost` – enable cost calculation and overlay totals/breakdowns on the diagram.
- `--period <period>` – aggregation period (`monthly`, `yearly`, etc.).
- `--pricing <model>` – pricing model (`on_demand`, `reserved`, etc., depending on support).
