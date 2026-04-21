# @mindfiredigital/adac-core

Core integration package for ADAC - brings together parsing, validation, and layout engines to orchestrate diagram generation.

## Features

- 🎯 Unified orchestration of parsing, validation, and rendering
- 🎨 Multiple layout engine support (ELK and Dagre)
- ✅ Compliance validation integration
- 📦 Zero external runtime dependencies (bundled)
- 🔄 Async/await support

## Installation

```bash
npm install @mindfiredigital/adac-core
# or
pnpm add @mindfiredigital/adac-core
```

## Usage

### Generate a Diagram (Node.js)

```typescript
import { generateDiagramSvg } from '@mindfiredigital/adac-core';
import fs from 'fs';

const yamlContent = fs.readFileSync('architecture.yaml', 'utf-8');

const result = await generateDiagramSvg(yamlContent, 'elk');
console.log(result.svg); // SVG output
```

### Layout Engine Selection

```typescript
// Using ELK (professional layout - recommended for complex diagrams)
const resultElk = await generateDiagramSvg(yaml, 'elk');

// Using Dagre (lightweight layout - good for simple hierarchies)
const resultDagre = await generateDiagramSvg(yaml, 'dagre');
```

### Error Handling

```typescript
try {
  const result = await generateDiagramSvg(yamlContent, 'elk');
} catch (error) {
  if (error.code === 'ADAC_PARSE_ERROR') {
    console.error('YAML parsing failed:', error.message);
  } else if (error.code === 'ADAC_VALIDATION_ERROR') {
    console.error('Schema validation failed:', error.details);
  }
}
```

## API Reference

### `generateDiagramSvg(yaml, layoutEngine): Promise<DiagramResult>`

Generates an SVG diagram from YAML content.

**Parameters:**

- `yaml` (string): ADAC YAML configuration
- `layoutEngine` (string): Layout algorithm - `'elk'` or `'dagre'`

**Returns:** `Promise<DiagramResult>`

```typescript
interface DiagramResult {
  svg: string; // SVG XML string
  logs: string[]; // Generation logs
  metadata: Metadata; // Diagram metadata
}
```

## See Also

- [@mindfiredigital/adac-parser](../parser) - YAML parsing
- [@mindfiredigital/adac-schema](../schema) - Schema validation
- [@mindfiredigital/adac-diagram](../diagram) - Distribution package

## License

MIT
