# @mindfiredigital/adac-validator

Generic schema validator for ADAC (Architecture Diagram As Code) definitions.

## Features

- Validates ADAC configuration objects against the shared core schema.
- Treats extension fields as opaque data unless a wrapper validates them.
- Supports explicit extension wrappers for domain-specific fields.
- Returns structured validation results.
- Supports ESM and TypeScript.

## Usage

```typescript
import { validateAdacConfig } from '@mindfiredigital/adac-validator';

const result = validateAdacConfig(config);

if (!result.valid) {
  console.error(result.errors);
}
```

## Extension wrappers

The validator package intentionally does not own domain-specific validation such
as cost. Extension fields can be present in ADAC documents, but the generic
validator treats them as opaque data. Packages that add optional ADAC fields
should provide a wrapper using the extension API when those fields need schema
checks.

```typescript
import { validateAdacConfig } from '@mindfiredigital/adac-validator';

const result = validateAdacConfig(config, {
  extensions: [
    {
      name: 'example',
      rootProperties: {
        example: { type: 'object' },
      },
    },
  ],
});
```

For cost-aware validation, use `validateAdacCostConfig` from
`@mindfiredigital/adac-cost`.
