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
| \`{{from}}\` | \`{{to}}\` | {{ports.[0]}} | \`{{protocol}}\` | {{description}} |
{{/each}}
`;

export const CostReportTemplate = `
# Estimated Cost Report

{{#if cost}}
## Summary
- **Total Estimated Monthly Cost**: {{cost.total_monthly_cost}} {{cost.currency}}
- **Total Estimated Yearly Cost**: {{cost.total_yearly_cost}} {{cost.currency}}

## Service Breakdown
| Service | Monthly Cost | Yearly Cost |
|---|---|---|
{{#each cost.breakdown}}
| {{service}} | {{monthly_cost}} | {{yearly_cost}} |
{{/each}}
{{else}}
*No cost estimation data available for this architecture.*

> [!TIP]
> To include cost data, use the \`adac cost\` command or include a \`cost\` field in your ADAC YAML.
{{/if}}
`;

export const ComplianceTemplate = `
# Compliance Report

*Generated for current architecture.*

{{#if results.length}}
## summary
- **Overall Status**: {{#if results.[0].isCompliant}}✅ COMPLIANT{{else}}❌ NON-COMPLIANT{{/if}}
- **Total Frameworks Checked**: {{results.length}}

## Remediation Plan
{{#if remediationPlan.length}}
{{#each remediationPlan}}
### {{id}} / {{resourceId}} ({{severity}})
**Frameworks**: {{frameworks}}

{{#each steps}}
- {{this}}
{{/each}}
{{/each}}
{{else}}
✅ All services are compliant with the declared frameworks.
{{/if}}

## Detailed Results
{{#each results}}
### {{framework}}
- **Compliant**: {{#if isCompliant}}✅ YES{{else}}❌ NO{{/if}}
- **Violations**: {{summary.total}}

{{#if violations.length}}
| Resource | Severity | Message |
|---|---|---|
{{#each violations}}
| \`{{resourceId}}\` | **{{severity}}** | {{message}} |
{{/each}}
{{/if}}
{{/each}}

{{else}}
**No compliance frameworks were specified for validation.**

> [!NOTE]
> Add \`compliance: [pci-dss, soc2, ...]\` to your services to enable compliance checking.
{{/if}}
`;
