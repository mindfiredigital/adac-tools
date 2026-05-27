---
sidebar_position: 4
---

# CLI Package

## `@mindfiredigital/adac-cli`

CLI command parser for ADAC diagram generation. Provides command-line interface utilities built on Commander.js.

## Features

- 🎯 Commander.js integration
- 📝 Command parsing and validation
- 💬 Help text generation
- ⚙️ Configuration handling
- 🔍 `--no-optimize` flag to skip architecture optimization analysis

## Installation

```bash
npm install @mindfiredigital/adac-cli
# or
pnpm add @mindfiredigital/adac-cli
```

## Usage

```typescript
import { runCLI } from '@mindfiredigital/adac-cli';

runCLI({
  version: '1.0.0',
  generateDiagram: async (
    input,
    output,
    layout,
    validate,
    costData,
    period,
    pricingModel,
    skipOptimizer
  ) => {
    // call your generation function here
  },
  parseAdac: (input) => {
    /* ... */
  },
  validateAdacConfig: (config) => ({ valid: true }),
});
```

## Commands

### `diagram <file>`

Generate an SVG diagram from an ADAC YAML file. The architecture optimizer runs automatically unless `--no-optimize` is passed.

| Flag                  | Default       | Description                                          |
| --------------------- | ------------- | ---------------------------------------------------- |
| `-l, --layout <type>` | `elk`         | `elk` or `dagre`                                     |
| `-o, --output <path>` | `<input>.svg` | Output path                                          |
| `--validate`          | —             | Schema validation before generation                  |
| `--cost`              | —             | Print cost breakdown                                 |
| Flag                  | Default       | Description                                          |
| ------                | ---------     | -------------                                        |
| `-l, --layout <type>` | `elk`         | Layout engine: `elk` or `dagre`                      |
| `-o, --output <path>` | `<input>.svg` | Output SVG file path                                 |
| `--validate`          | —             | Run schema validation before generation              |
| `--cost`              | —             | Print cost breakdown                                 |
| `--pricing <model>`   | `on_demand`   | Pricing model (`on_demand` or `reserved`)            |
| `--period <period>`   | `monthly`     | Cost period (`hourly`, `daily`, `monthly`, `yearly`) |
| `--no-optimize`       | —             | **Skip architecture optimization analysis**          |

### `validate <file>`

Validate a YAML file against the ADAC schema.

### `cost <file>`

Print a cost breakdown for the given architecture.

### `terraform <file>`

Generate Terraform files from the ADAC YAML.

## `CLIOptions` Interface

```typescript
export type CLIOptions = {
  generateDiagram: (
    input: string,
    output: string,
    layoutOverride?: 'elk' | 'dagre',
    validate?: boolean,
    costData?: Record<string, number>,
    period?: CostPeriod,
    pricingModel?: PricingModel,
    skipOptimizer?: boolean // NEW — maps from --no-optimize flag
  ) => Promise<void>;
  calculateCostFromYaml?: (
    input: string,
    period?: CostPeriod,
    pricingModel?: PricingModel
  ) => CostBreakdown;
  generateTerraformFromYaml?: (
    input: string,
    outputDir?: string,
    validate?: boolean
  ) => Promise<void>;
  parseAdac: (input: string, options?: Record<string, unknown>) => unknown;
  validateAdacConfig: (config: unknown) => {
    valid: boolean;
    errors?: string[];
  };
  version: string;
};
```

## Development Details & Roadmap

Based on the [feature specifications](https://github.com/mindfiredigital/adac-tools/issues/13), the CLI package acts as the main orchestrator for the ADAC tools. It is designed to be highly performant and extensible.

### Core Objectives

- **Orchestrator Pattern**: Acts as the main `adac` entry point, lazy‑loading other packages (`validator`, `diagram`, `cost`) as needed to keep startup time extremely fast.
- **Yargs Integration**: Uses a `yargs`‑based CLI structure for robust argument and flag parsing.
- **Scaffolding**: Implements an `adac init` command to scaffold new ADAC configuration files.
- **Extensibility**: Includes a plugin and module loader for future command integrations.

### Key Dependencies

- `@mindfiredigital/adac-validator`
- `yargs`
- `chalk`
- `ora`

---
