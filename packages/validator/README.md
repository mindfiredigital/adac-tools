# @mindfiredigital/adac-validator

Validator for ADAC (Architecture Diagram As Code) definitions.

## What it validates

- ADAC 0.1 and 0.2 files, as plain objects, against the shared schema.
- The declarative layout and styling properties of 0.2: `layoutOptions`
  (including `layoutOptions.defaults`), `visual.layout`, `visual.style`, and a
  connection's `layout` and `bidirectional`.
- Extension fields are treated as opaque data unless an extension wrapper
  validates them (see [Extension wrappers](#extension-wrappers)).

The result is a structured object: `valid`, the `errors`, and any `warnings`
(for example when layout properties are declared for a layout engine that
ignores them).

## Install

```bash
npm install @mindfiredigital/adac-validator
```

Supported Node.js versions: 20 and 22. The package ships CommonJS and ES module
builds, with TypeScript types for both.

## Usage

CommonJS:

```js
const { validateAdacConfig } = require('@mindfiredigital/adac-validator');

const result = validateAdacConfig(config);
if (!result.valid) {
  console.error(result.errors);
}
```

ES modules / TypeScript:

```ts
import { validateAdacConfig } from '@mindfiredigital/adac-validator';

const result = validateAdacConfig(config);
if (!result.valid) {
  console.error(result.errors);
}
```

`config` is the parsed document, for example the result of reading an
`.adac.yaml` file with a YAML parser.

## Extension wrappers

The validator does not own domain-specific validation such as cost. Packages
that add optional ADAC fields can pass an extension so those fields are
checked:

```ts
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

## License

MIT
