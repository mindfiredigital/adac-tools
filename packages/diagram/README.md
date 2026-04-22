# @mindfiredigital/adac-diagram

Core diagram generation logic and CLI for ADAC (Architecture Diagram As Code). Includes automatic **architecture optimization** analysis on every diagram generation.

## Features

- **CLI Tool**: The `adac` command-line tool for generating SVG diagrams from YAML
- **Multiple Layout Engines**: ELK (`elkjs`) and Dagre
- **SVG Rendering**: High-quality SVG output with embedded icons and styling
- **Validation**: Integrated schema validation before generation
- **🔍 Optimizer**: Automatic architecture optimization recommendations (cost, security, reliability) printed to the console on every run

## CLI Usage

### Install globally

```bash
npm install -g @mindfiredigital/adac-diagram
```

### Generate a diagram

```bash
# Basic usage — optimizer summary printed automatically
adac diagram architecture.adac.yaml -o output.svg

# Select layout engine
adac diagram architecture.adac.yaml -o output.svg --layout elk
adac diagram architecture.adac.yaml -o output.svg --layout dagre

# Validate schema before generation
adac diagram architecture.adac.yaml --validate

# Include cost breakdown
adac diagram architecture.adac.yaml --cost --period monthly --pricing reserved

# Disable optimization analysis
adac diagram architecture.adac.yaml --no-optimize
```

### Local development (from monorepo root)

```bash
pnpm cli diagram yamls/aws.adac.yaml -o test_aws.svg
pnpm cli diagram yamls/gcp.adac.yaml -o test_gcp.svg
pnpm cli diagram yamls/aws.adac.yaml --no-optimize -o test_aws.svg
```

### All `diagram` options

| Flag                  | Default       | Description                               |
| --------------------- | ------------- | ----------------------------------------- |
| `-l, --layout <type>` | `elk`         | Layout engine: `elk` or `dagre`           |
| `-o, --output <path>` | `<input>.svg` | Output SVG file path                      |
| `--validate`          | —             | Run schema validation before generation   |
| `--cost`              | —             | Print cost breakdown alongside generation |
| `--pricing <model>`   | `on_demand`   | `on_demand` or `reserved`                 |
| `--period <period>`   | `monthly`     | `hourly`, `daily`, `monthly`, `yearly`    |
| `--no-optimize`       | —             | Skip architecture optimization analysis   |

### Other commands

```bash
adac validate architecture.adac.yaml     # Schema validation only
adac cost architecture.adac.yaml         # Cost analysis only
adac terraform architecture.adac.yaml    # Generate Terraform files
```

## Programmatic Usage

```typescript
import {
  generateDiagram,
  generateDiagramSvg,
} from '@mindfiredigital/adac-diagram';

// File → file (generates SVG, optimizer runs automatically)
await generateDiagram(
  'input.adac.yaml',
  'output.svg',
  'elk',
  true, // validate
  undefined, // costData
  'monthly', // period
  false // skipOptimizer (set true to disable)
);

// String → string (returns svg + optimizationResult)
const yaml = fs.readFileSync('input.adac.yaml', 'utf-8');
const { svg, optimizationResult } = await generateDiagramSvg(yaml, 'elk');

if (optimizationResult) {
  console.log(
    `${optimizationResult.summary.total} optimization recommendations`
  );
}
```

## See Also

- [@mindfiredigital/adac-optimizer](../optimizer) — Architecture optimization rules
- [@mindfiredigital/adac-core](../core) — Core generation engine
- [@mindfiredigital/adac-cli](../cli) — CLI argument parsing
- [@mindfiredigital/adac-compliance](../compliance) — Compliance checking

## License

MIT
