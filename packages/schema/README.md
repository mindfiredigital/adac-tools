# @mindfiredigital/adac-schema

ADAC (Architecture Diagram As Code) schema and validation logic.

## Usage

```typescript
import { validateAdacConfig } from '@mindfiredigital/adac-schema';

const config = { ... };
const result = validateAdacConfig(config);

if (result.valid) {
  console.log('Valid!');
} else {
  console.error('Errors:', result.errors);
}
```

## Features

- **JSON Schema Validation**: Uses Ajv for high-performance validation against the ADAC specification.
- **TypeScript Types**: Shared interfaces for `AdacConfig`, `AdacService`, etc.
- **Multi-Cloud Support**: Initial support for AWS with flexibility for other providers.
