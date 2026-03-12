export const ArchitectureTemplate = `
# Architecture Overview

{{#if metadata.version}}
**Version**: {{metadata.version}}
{{/if}}
{{#if metadata.description}}
**Description**: {{metadata.description}}
{{/if}}

## Environment
{{#each clouds}}
- **Provider**: {{provider}} (Region: {{region}}{{#if project_id}}, Project: {{project_id}}{{/if}})
{{/each}}

## Diagram
![Architecture Diagram](./architecture.png)

`;

export const ServiceCatalogTemplate = `
# Service Catalog

| Service ID | Name | Service Type | Provider | Description |
|---|---|---|---|---|
{{#each services}}
| \`{{id}}\` | {{name}} | {{service}} | \`{{provider}}\` | {{description}} |
{{/each}}
`;

export const ConnectionMatrixTemplate = `
# Connection Matrix

| Source | Target | Ports | Protocol | Description |
|---|---|---|---|---|
{{#each connections}}
| \`{{source}}\` | \`{{target}}\` | {{ports.[0]}} | \`{{protocol}}\` | {{description}} |
{{/each}}
`;

export const CostReportTemplate = `
# estimated Cost Report

*Generated for current architecture.*
`;

export const ComplianceTemplate = `
# Compliance Report

*Generated for current architecture.*
`;
