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

## File Structure

```text
packages/cost/
  src/
    index.ts
    calculator.ts               # CostCalculator class
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
