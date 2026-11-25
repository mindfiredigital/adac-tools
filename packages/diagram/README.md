# @mindfiredigital/adac-diagram

Core diagram generation logic and CLI for ADAC (Architecture Diagram As Code). Includes automatic **architecture optimization** analysis on every diagram generation.

**Note:** This package is released and distributed as an npm module.

## Features

- **CLI Tool**: The `adac` command-line tool for generating SVG diagrams from YAML
- **Layout engines**: `elk` (default; the only engine with declarative layout), `custom`, `orthogonal`, `tsm`
- **SVG Rendering**: High-quality SVG output with embedded icons and styling
- **Validation**: Integrated schema validation before generation
- **Compliance**: Automatically checks declared compliance frameworks and passes tooltip metadata into the core renderer
- **🔍 Optimizer**: Automatic architecture optimization recommendations (cost, security, reliability) printed to the console on every run
- **💡 Interactive Tooltips**: Generated SVGs embed cost, compliance, and optimization metadata directly into node tooltips for easy inspection.

## CLI Usage

## Run Standalone

This package exposes the `adac` binary and can be run as the main standalone
ADAC CLI.

### Install globally

```bash
npm install -g @mindfiredigital/adac-diagram @mindfiredigital/adac-icons-aws
```

AWS icons come from `@mindfiredigital/adac-icons-aws`. Install both packages in the same command (or in the same project). Without it, diagrams are drawn without icons. GCP and Azure icons are not available from npm yet.

### Generate a diagram

```bash
# Basic usage — optimizer summary printed automatically
adac diagram architecture.adac.yaml -o output.svg

# Select layout engine
adac diagram architecture.adac.yaml -o output.svg --layout elk


# Validate schema before generation
adac diagram architecture.adac.yaml --validate

# Include cost breakdown
adac diagram architecture.adac.yaml --cost --period monthly --pricing reserved

# Disable optimization analysis
adac diagram architecture.adac.yaml --no-optimize
```

### Local development (from monorepo root)

```bash
pnpm --filter @mindfiredigital/adac-diagram build
pnpm cli diagram yamls/aws.adac.yaml -o test_aws.svg
pnpm cli diagram yamls/gcp.adac.yaml -o test_gcp.svg
pnpm cli diagram yamls/aws.adac.yaml --no-optimize -o test_aws.svg
```

You can also run the package binary directly after building:

```bash
node packages/diagram/dist/cli.js diagram yamls/aws.adac.yaml -o test_aws.svg --no-open
```

### All `diagram` options

| Flag                  | Default                                                         | Description                                           |
| --------------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| `-l, --layout <type>` | `layoutOptions.engine`, then the top-level `layout`, then `elk` | Layout engine: `elk`, `custom`, `orthogonal` or `tsm` |
| `-o, --output <path>` | `<input>.svg`                                                   | Output SVG file path                                  |
| `--validate`          | —                                                               | Run schema validation before generation               |
| `--cost`              | —                                                               | Print cost breakdown alongside generation             |
| `--pricing <model>`   | `on_demand`                                                     | `on_demand` or `reserved`                             |
| `--period <period>`   | `monthly`                                                       | `hourly`, `daily`, `monthly`, `yearly`                |
| `--no-optimize`       | —                                                               | Skip architecture optimization analysis               |
| `--no-open`           | —                                                               | Skip opening the diagram in the browser               |

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

## Declarative layout (ADAC 0.2)

- `layoutOptions` sets diagram-wide defaults: direction, gap, container padding, alignment and edge routing.
- `visual.layout` arranges one element's children, and `visual.style` styles the element.
- A connection takes its own `layout` (sides and routing) and `bidirectional`.
- `layoutOptions.defaults: none` switches off the default layout profile, which fills in the options you leave out.
- Only the `elk` engine honours these properties; with `custom`, `orthogonal` or `tsm` you get one warning per file. See [docs/DECLARATIVE_LAYOUT.md](https://github.com/mindfiredigital/adac-tools/blob/main/docs/DECLARATIVE_LAYOUT.md).

## Upgrading from 0.1.x

- The `dagre` layout engine is removed: `layout: dagre` and `--layout dagre` fail with `Unsupported layout engine`. Use `elk` (the default) or `custom`.
- Containers without declared padding are more compact (side and bottom padding 40 px to 30 px, top stays 60 px). `layoutOptions.defaults: none` restores the old padding.
- `adac diagram` prints every `Warning:` log line to stderr (exit codes are unchanged), and `adac validate` prints all validator warnings.
- The legend is kept clear of the diagram, so the SVG may grow (height up to 120 px, width up to 200 px) when no clear spot exists.
- AWS icons moved to the separate package `@mindfiredigital/adac-icons-aws`; install it next to `@mindfiredigital/adac-diagram` to get icons.

## See Also

- [@mindfiredigital/adac-core](../core) — Core generation engine
- [@mindfiredigital/adac-cli](../cli) — CLI argument parsing
- [@mindfiredigital/adac-compliance](../compliance) — Compliance checking

## License

MIT
