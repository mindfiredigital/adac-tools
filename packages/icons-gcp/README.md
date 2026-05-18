# @mindfiredigital/adac-icons-gcp

GCP service icons and mappings for ADAC diagrams.

## Features

- 🎨 GCP service icons
- 🗺️ Service-to-icon mappings
- 📦 SVG format
- 🔄 Dynamic loading

## Installation

```bash
npm install @mindfiredigital/adac-icons-gcp
pnpm add @mindfiredigital/adac-icons-gcp
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
