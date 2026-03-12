# @mindfiredigital/adac-diagram

Core diagram generation logic and CLI for ADAC (Architecture Diagram As Code).

## Features

- **CLI Tool**: The `adac` command-line tool for generating SVG diagrams from YAML.
- **Multiple Layout Engines**: Support for ELK (`elkjs`) and Dagre.
- **SVG Rendering**: High-quality SVG output with embedded icons and styling.
- **Validation**: Integrated schema validation before generation.

## CLI Usage

If installed globally or run via `npx`:

```bash
adac diagram architecture.yaml -o output.svg
```

### Local Development Usage

From the root of the monorepo:

```bash
pnpm cli diagram yamls/aws.adac.yaml -o test_aws.svg
pnpm cli diagram yamls/gcp.adac.yaml -o test_gcp.svg
```

### Options

- `diagram <file>`: Main command to generate a diagram.
  - `-l, --layout <type>`: Layout engine (`elk` or `dagre`, default: `elk`).
  - `-o, --output <path>`: Output SVG file path.
  - `--validate`: Run schema validation before generating.
- `validate <file>`: Validate a file against the ADAC schema.

## Programmatic Usage

```typescript
import { generateDiagram } from '@mindfiredigital/adac-diagram';

await generateDiagram(
  'input.yaml', // ADAC yaml containing aws or gcp provider specs
  'output.svg',
  'elk',
  true // validate
);
// Note: Icon sets, styles, and compliance checks automatically adapt to the provider (AWS/GCP) listed in the YAML.
```
