# `@mindfiredigital/adac-templates`

A library of common, pre-configured cloud architecture templates in the ADAC (Architecture Definition as Code) format.

This package provides a programmatic way to access standard architectures like a classic 3-tier web app, serverless APIs, and microservices environments.

## Installation

\`\`\`bash
npm install @mindfiredigital/adac-templates

# or

pnpm add @mindfiredigital/adac-templates

# or

yarn add @mindfiredigital/adac-templates
\`\`\`

## Usage

\`\`\`typescript
import {
getAllTemplates,
getTemplateById,
getTemplateConfig,
} from '@mindfiredigital/adac-templates';

// 1. Get all available templates
const allTemplates = getAllTemplates();
allTemplates.forEach((t) => {
console.log(\`\${t.id}: \${t.name} - \${t.description}\`);
});

// 2. Get a specific template by ID
const aws3Tier = getTemplateById('aws-3-tier-web');
if (aws3Tier) {
console.log(aws3Tier.config); // The ADAC YAML equivalent object
}

// 3. Just get the configuration directly
const serverlessConfig = getTemplateConfig('aws-serverless-api');
if (serverlessConfig) {
console.log(serverlessConfig.infrastructure.name);
}
\`\`\`

## Available Templates

Currently included templates:

- **\`aws-3-tier-web\`**: AWS 3-Tier Web Architecture (ALB, EC2, RDS, ElastiCache)
- **\`aws-serverless-api\`**: AWS Serverless API (API Gateway, Lambda, DynamoDB, S3)
- **\`gcp-microservices\`**: GCP Microservices (GKE, Cloud SQL, Pub/Sub, Cloud Storage)

## Contributing

To add a new template:

1. Create a new `.ts` file in `src/` (e.g., `azure-data-lake.ts`).
2. Export the `AdacConfig` object.
3. Import and add it to the `templates` array in `src/index.ts`.
