# @mindfiredigital/adac-core

Core integration package for ADAC — brings together parsing, validation, graph building, SVG rendering, and **architecture optimization** to orchestrate diagram generation.

**Note:** This package is released and distributed as an npm module.

## Features

- 🎯 Unified orchestration of parsing, validation, and rendering
- 🎨 Multiple layout engine support (ELK and Custom)
- ✅ Accepts precomputed compliance tooltip metadata from higher-level packages
- 🔍 **Architecture optimizer** — runs automatically, produces prioritised recommendations
- 📦 Zero external runtime dependencies (bundled)
- 🔄 Async/await support

## Installation

```bash
npm install @mindfiredigital/adac-core
# or
pnpm add @mindfiredigital/adac-core
```

## Usage

### Generate a diagram (with optimizer)

```typescript
import { generateDiagramSvg } from '@mindfiredigital/adac-core';
import fs from 'fs';

const yamlContent = fs.readFileSync('architecture.adac.yaml', 'utf-8');

const { svg, logs, duration, optimizationResult } = await generateDiagramSvg(
  yamlContent,
  'elk'
);

console.log(svg); // SVG string

// Optimizer recommendations come back automatically
if (optimizationResult) {
  const { summary, recommendations } = optimizationResult;
  console.log(
    `Optimizer: ${summary.total} recommendations (${summary.critical} critical)`
  );
  for (const rec of recommendations) {
    console.log(
      `  [${rec.severity}] ${rec.title} → ${rec.affectedResources.join(', ')}`
    );
  }
}
```

### Disable optimizer

```typescript
const skipOptimizer = true;
const result = await generateDiagramSvg(
  yaml,
  'elk',
  false,
  undefined,
  'monthly',
  skipOptimizer
);
```

### Layout engine selection

```typescript
// ELK (professional layout — recommended for complex diagrams)
const resultElk = await generateDiagramSvg(yaml, 'elk');

// Custom (user-defined layout algorithm)
const resultCustom = await generateDiagramSvg(yaml, 'custom');
```

### Error handling

```typescript
try {
  const result = await generateDiagramSvg(yamlContent, 'elk');
} catch (error) {
  // error.logs contains the generation log trail
  console.error(error.message, error.logs);
}
```

## API Reference

### `generateDiagramSvg(yaml, layoutEngine?, validate?, costData?, period?, skipOptimizer?, complianceProvider?, iconResolver?)`

Generates an SVG diagram from YAML content. Runs the architecture optimizer automatically. Compliance checks are supplied by callers through `complianceProvider`; `@mindfiredigital/adac-diagram` wires this provider to `@mindfiredigital/adac-compliance` for the full CLI/distribution experience.

| Parameter            | Type                                                              | Default     | Description                                   |
| -------------------- | ----------------------------------------------------------------- | ----------- | --------------------------------------------- |
| `yaml`               | `string`                                                          | —           | ADAC YAML configuration content               |
| `layoutEngine`       | `'elk' \| 'custom'`                                               | `'elk'`     | Graph layout algorithm                        |
| `validate`           | `boolean`                                                         | `false`     | Run schema validation before layout           |
| `costData`           | `Record<string, number>`                                          | —           | Per-service cost overrides (optional)         |
| `period`             | `'hourly' \| 'daily' \| 'monthly' \| 'yearly'`                    | `'monthly'` | Cost display period                           |
| `skipOptimizer`      | `boolean`                                                         | `false`     | Set `true` to skip optimization analysis      |
| `complianceProvider` | `(adac) => ComplianceTooltipMap \| Promise<ComplianceTooltipMap>` | —           | Optional provider for compliance tooltip data |
| `iconResolver`       | `(iconName) => Promise<string \| null>`                           | —           | Optional browser icon asset resolver          |

**Returns:** `Promise<GenerationResult>`

```typescript
interface GenerationResult {
  svg: string; // SVG XML string
  logs: string[]; // Timestamped generation log entries
  duration: number; // Total time in milliseconds
  optimizationResult?: OptimizationResult; // Undefined if skipOptimizer=true
}
```

---

### `generateDiagram(input, output, layoutEngine?, validate?, costData?, period?, skipOptimizer?, complianceProvider?, iconResolver?)`

File-based wrapper around `generateDiagramSvg`. Reads the YAML from `input` and writes the SVG to `output`.

---

### Re-exported helpers

```typescript
export { parseAdac, parseAdacFromContent } from '@mindfiredigital/adac-parser';
export { validateAdacConfig } from '@mindfiredigital/adac-validator';
export { buildElkGraph } from '@mindfiredigital/adac-layout-elk';
```

## Generation pipeline

```
YAML input
  │
  ├─ parseAdacFromContent()     ← adac-parser
  ├─ validateAdacConfig()       ← adac-validator        (if validate=true)
  ├─ complianceProvider()       ← optional caller-supplied tooltip metadata
  ├─ buildElkGraph()            ← adac-layout-elk
  ├─ renderSvg()                ← internal renderer
  └─ GenerationResult { svg, logs, duration, optimizationResult }
```

## See Also

- [@mindfiredigital/adac-parser](../parser) — YAML parsing
- [@mindfiredigital/adac-validator](../validator) — Validation
- [@mindfiredigital/adac-diagram](../diagram) — Distribution package & CLI

## License

MIT
