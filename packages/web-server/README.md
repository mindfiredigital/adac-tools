# @mindfiredigital/adac-web-server

Express API server for ADAC diagram generation and compliance services.

## Features

- 🚀 RESTful API for diagram generation
- 💼 Express.js based
- ✅ Compliance validation endpoints
- 💰 Cost analysis endpoints
- 🔄 CORS enabled

## Installation

```bash
npm install @mindfiredigital/adac-web-server
pnpm add @mindfiredigital/adac-web-server
```

## Usage

```typescript
import express from 'express';
import { setupAdacRoutes } from '@mindfiredigital/adac-web-server';

const app = express();
setupAdacRoutes(app);

app.listen(3000, () => {
  console.log('API server running on http://localhost:3000');
});
```

## API Endpoints

### POST /api/diagram/generate

Generate a diagram from YAML configuration.

```bash
curl -X POST http://localhost:3000/api/diagram/generate \
  -H "Content-Type: application/json" \
  -d '{
    "yaml": "services:\n  api:\n    name: API",
    "layout": "elk"
  }'
```

### POST /api/compliance/check

Check compliance requirements.

### POST /api/cost/estimate

Estimate infrastructure costs.

## Environment Variables

- `PORT` - Server port (default: 3000)
- `LOG_LEVEL` - Logging level (default: info)

## See Also

- [@mindfiredigital/adac-core](../core) - Core engine
- [@mindfiredigital/adac-diagram](../diagram) - CLI tool
- [@mindfiredigital/adac-web](../web) - Web UI

## License

MIT
