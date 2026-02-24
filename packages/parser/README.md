# @mindfiredigital/adac-parser

YAML parser for ADAC (Architecture Diagram As Code) files.

## Features

- Parses ADAC YAML files into structured JSON.
- Built-in schema validation using `@mindfiredigital/adac-schema`.
- Supports ESM and TypeScript.

## Usage

```typescript
import { parseAdac } from '@mindfiredigital/adac-parser';

// Parse and validate a file
try {
  const config = parseAdac('architecture.yaml');
  console.log(config.metadata.name);
} catch (e) {
  console.error('Failed to parse or validate:', e.message);
}

// Parse without validation
const rawConfig = parseAdac('architecture.yaml', { validate: false });
```
