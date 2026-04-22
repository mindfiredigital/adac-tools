# @mindfiredigital/adac-core

Core integration package for ADAC — brings together parsing, validation, layout engines, compliance checking, and **architecture optimization** to orchestrate diagram generation.

## Features

- 🎯 Unified orchestration of parsing, validation, and rendering
- 🎨 Multiple layout engine support (ELK and Dagre)
- ✅ Compliance validation integration (auto-detected from YAML)
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

// Dagre (lightweight — good for simple hierarchies)
const resultDagre = await generateDiagramSvg(yaml, 'dagre');
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

### `generateDiagramSvg(yaml, layoutEngine?, validate?, costData?, period?, skipOptimizer?)`

Generates an SVG diagram from YAML content. Runs compliance checks and the architecture optimizer automatically.

| Parameter       | Type                                           | Default     | Description                              |
| --------------- | ---------------------------------------------- | ----------- | ---------------------------------------- |
| `yaml`          | `string`                                       | —           | ADAC YAML configuration content          |
| `layoutEngine`  | `'elk' \| 'dagre'`                             | `'elk'`     | Graph layout algorithm                   |
| `validate`      | `boolean`                                      | `false`     | Run schema validation before layout      |
| `costData`      | `Record<string, number>`                       | —           | Per-service cost overrides (optional)    |
| `period`        | `'hourly' \| 'daily' \| 'monthly' \| 'yearly'` | `'monthly'` | Cost display period                      |
| `skipOptimizer` | `boolean`                                      | `false`     | Set `true` to skip optimization analysis |

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

### `generateDiagram(input, output, layoutEngine?, validate?, costData?, period?, skipOptimizer?)`

File-based wrapper around `generateDiagramSvg`. Reads the YAML from `input` and writes the SVG to `output`.

---

### Re-exported helpers

```typescript
export { parseAdac, parseAdacFromContent } from '@mindfiredigital/adac-parser';
export { validateAdacConfig } from '@mindfiredigital/adac-schema';
export { buildElkGraph } from '@mindfiredigital/adac-layout-elk';
export { layoutDagre } from '@mindfiredigital/adac-layout-dagre';
```

## Generation pipeline

```
YAML input
  │
  ├─ parseAdacFromContent()     ← adac-parser
  ├─ validateAdacConfig()       ← adac-schema        (if validate=true)
  ├─ OptimizerEngine.analyze()  ← adac-optimizer     (unless skipOptimizer)
  ├─ ComplianceChecker()        ← adac-compliance
  ├─ buildElkGraph()            ← adac-layout-elk
  ├─ renderSvg()                ← internal renderer
  └─ GenerationResult { svg, logs, duration, optimizationResult }
```

## See Also

- [@mindfiredigital/adac-optimizer](../optimizer) — Architecture optimization rules
- [@mindfiredigital/adac-parser](../parser) — YAML parsing
- [@mindfiredigital/adac-schema](../schema) — Schema validation
- [@mindfiredigital/adac-diagram](../diagram) — Distribution package & CLI

## License

MIT
