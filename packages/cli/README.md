# @mindfiredigital/adac-cli

CLI command parser for ADAC diagram generation. Provides command-line interface utilities built on Commander.js.

## Features

- 🎯 Commander.js integration
- 📝 Command parsing and validation
- 💬 Help text generation
- ⚙️ Configuration handling
- 🔍 `--no-optimize` flag to skip architecture optimization analysis

## Installation

> **Note:** This is an internal workspace package and is **not** distributed as a standalone npm module. It is intended to be used within the ADAC monorepo.

To use it in another workspace package, add it to your `package.json`:

```json
{
  "dependencies": {
    "@mindfiredigital/adac-cli": "workspace:*"
  }
}
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
  validateAdacCostConfig: (config) => ({ valid: true }),
});
```

## Commands

### `diagram <file>`

Generate an SVG diagram from an ADAC YAML file. The architecture optimizer runs automatically unless `--no-optimize` is passed.

| Flag                  | Default       | Description                                 |
| --------------------- | ------------- | ------------------------------------------- |
| `-l, --layout <type>` | `custom`      | `elk`, `custom`, `orthogonal`, or `tsm`     |
| `-o, --output <path>` | `<input>.svg` | Output path                                 |
| `--validate`          | —             | Schema validation before generation         |
| `--cost`              | —             | Print cost breakdown                        |
| `--pricing <model>`   | `on_demand`   | `on_demand` or `reserved`                   |
| `--period <period>`   | `monthly`     | `hourly` / `daily` / `monthly` / `yearly`   |
| `--no-optimize`       | —             | **Skip architecture optimization analysis** |

### `validate <file>`

Validate a YAML file against the ADAC schema.

### `cost <file>`

Print cost breakdown for the given architecture.

### `terraform <file>`

Generate Terraform files from the ADAC YAML.

## `CLIOptions` interface

```typescript
export type CLIOptions = {
  generateDiagram: (
    input: string,
    output: string,
    layoutOverride?: 'elk' | 'custom' | 'orthogonal' | 'tsm',
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
  validateAdacCostConfig: (config: unknown) => {
    valid: boolean;
    errors?: string[];
  };
  version: string;
};
```

## See Also

- [@mindfiredigital/adac-diagram](../diagram) — Main CLI distribution
- [@mindfiredigital/adac-core](../core) — Core engine

## License

MIT
