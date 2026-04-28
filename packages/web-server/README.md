# @mindfiredigital/adac-web-server

Express API server for ADAC diagram generation, compliance checking, cost analysis, and **architecture optimization**.

## Features

- 🚀 RESTful API for diagram generation
- 💼 Express.js based
- ✅ Compliance validation endpoints
- 💰 Cost analysis endpoints
- 🔍 **Architecture optimization endpoint** (`POST /api/optimize`)
- 🗜️ **Gzip / Brotli response compression** (saves significant bandwidth for large SVG payloads)
- 🔄 CORS enabled

## Installation & Start

```bash
# From monorepo root
cd packages/web-server
pnpm install
pnpm build
pnpm start       # http://localhost:3000

# Development
pnpm dev
```

## Environment Variables

| Variable   | Default | Description                                               |
| ---------- | ------- | --------------------------------------------------------- |
| `PORT`     | `3000`  | HTTP port to listen on                                    |
| `NODE_ENV` | —       | Set to `development` to expose error details in responses |

## API Endpoints

All request bodies are JSON. All responses are **compressed** (gzip/brotli negotiated automatically).

---

### `POST /api/generate`

Generate a diagram SVG from an ADAC YAML string.

**Request**

```json
{
  "content": "<ADAC YAML string>",
  "layout": "elk"
}
```

| Field     | Type               | Required | Description                    |
| --------- | ------------------ | -------- | ------------------------------ |
| `content` | `string`           | ✅       | ADAC YAML content              |
| `layout`  | `'elk' \| 'dagre'` | —        | Layout engine (default: `elk`) |

**Response `200`**

```json
{
  "svg": "<svg …>…</svg>",
  "logs": ["[2026-…] Starting diagram generation.", "…"],
  "duration": 312,
  "optimizationResult": { … }
}
```

---

### `POST /api/compliance-check`

Evaluate a configuration against compliance frameworks declared in the YAML.

**Request**

```json
{ "content": "<ADAC YAML string>" }
```

**Response `200`**

```json
{
  "byService": { "serviceId": [ … ] },
  "results": [ … ],
  "remediationPlan": [ … ]
}
```

---

### `POST /api/cost`

Calculate the cost breakdown for an architecture.

**Request**

```json
{ "content": "<ADAC YAML string>" }
```

---

### `POST /api/optimize`

Run the architecture optimizer and return prioritised recommendations.

**Request**

```json
{
  "content": "<ADAC YAML string>",
  "options": {
    "categories": ["cost", "security"],
    "minSeverity": "high",
    "enableCostRules": true,
    "enableSecurityRules": true,
    "enableReliabilityRules": true
  }
}
```

| Field                            | Type       | Description                                                |
| -------------------------------- | ---------- | ---------------------------------------------------------- |
| `content`                        | `string`   | ADAC YAML (required)                                       |
| `options.categories`             | `string[]` | Filter: `cost`, `security`, `reliability`, `architecture`  |
| `options.minSeverity`            | `string`   | Minimum level: `critical`, `high`, `medium`, `low`, `info` |
| `options.enableCostRules`        | `boolean`  | Toggle cost rules (default `true`)                         |
| `options.enableSecurityRules`    | `boolean`  | Toggle security rules (default `true`)                     |
| `options.enableReliabilityRules` | `boolean`  | Toggle reliability rules (default `true`)                  |

**Response `200`**

```json
{
  "recommendations": [
    {
      "id": "security-no-encryption-rds-1",
      "title": "Encryption at rest not configured",
      "description": "…",
      "category": "security",
      "severity": "critical",
      "affectedResources": ["rds-1"],
      "actionItems": ["Set configuration.encrypted: true …", "…"],
      "referenceUrl": "https://docs.aws.amazon.com/…"
    }
  ],
  "byService": { "rds-1": [ … ] },
  "summary": {
    "critical": 1,
    "high": 2,
    "medium": 0,
    "low": 1,
    "info": 3,
    "total": 7,
    "totalEstimatedSavingsUsd": 0
  },
  "analyzedAt": "2026-04-22T06:15:00.000Z"
}
```

**cURL example**

```bash
curl -X POST http://localhost:3000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "content": "version: \"0.1\"\nmetadata:\n  name: my-arch\ninfrastructure:\n  clouds:\n    - id: aws-prod\n      provider: aws\n      region: us-east-1\n      services:\n        - id: rds-1\n          service: rds\n",
    "options": { "minSeverity": "high" }
  }'
```

## Response compression

All endpoints compress their responses using standard HTTP content-encoding negotiation (`Accept-Encoding: gzip, br`). This typically reduces payload size by **60–80%** for JSON and SVG responses — especially beneficial for large architecture diagrams.

## See Also

- [@mindfiredigital/adac-optimizer](../optimizer) — Optimizer package
- [@mindfiredigital/adac-core](../core) — Core engine
- [@mindfiredigital/adac-diagram](../diagram) — CLI tool
- [@mindfiredigital/adac-web](../web) — Web UI

## License

MIT
