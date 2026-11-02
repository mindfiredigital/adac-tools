# @mindfiredigital/adac-icons-gcp

GCP service icons and mappings for ADAC diagrams.

## Features

- 🎨 GCP service icons
- 🗺️ Service-to-icon mappings
- 📦 SVG format
- 🔄 Dynamic loading

## Installation

> **Note:** This is an internal workspace package and is **not** distributed as a standalone npm module. It is intended to be used within the ADAC monorepo.

To use it in another workspace package, add it to your `package.json`:

```json
{
  "dependencies": {
    "@mindfiredigital/adac-icons-gcp": "workspace:*"
  }
}
```

## Usage

```typescript
import { getGcpIcon, getGcpServiceIcon } from '@mindfiredigital/adac-icons-gcp';

// Get icon by service
const cloudFunctions = getGcpServiceIcon('cloud-functions');
console.log(cloudFunctions.url);

// Get icon by ID
const compute = getGcpIcon('compute-engine');
console.log(compute.name);
```

## Services

- Compute Engine
- Cloud Functions
- Cloud Run
- App Engine
- Cloud SQL
- Firestore
- BigQuery
- And more...

## See Also

- [@mindfiredigital/adac-icons-aws](../icons-aws) - AWS icons
- [@mindfiredigital/adac-icons-azure](../icons-azure) - Azure icons
- [@mindfiredigital/adac-diagram](../diagram) - Diagram generator

## License

MIT
