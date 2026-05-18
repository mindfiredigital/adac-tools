# @mindfiredigital/adac-compliance

Security and structural audit package for ADAC (AWS Diagram As Code).

## Overview

This package evaluates an ADAC infrastructure configuration against various compliance frameworks. It reads the service-level `compliance` array from the YAML definition and runs the matching validation rules for each service.

Current supported frameworks:

- `pci-dss`
- `soc2`
- `hipaa`
- `gdpr`
- `iso27001`
- `fedramp`

## Validation Strategy

Compliance is executed on a **per-service** basis. To enforce a compliance check, a service must declare the standard in its configuration block inside the YAML:

```yaml
services:
  - id: my-secure-db
    service: rds
    compliance:
      - pci-dss
      - soc2
    config:
      encrypted: true
```

If a service does not have a `compliance` attribute, it is dynamically skipped by the evaluator.

## Programmatic Usage

The `.checkCompliance(config)` method returns a structured breakdown of evaluations mapped by service ID:

```typescript
import { ComplianceChecker } from '@mindfiredigital/adac-compliance';
import { parseAdac } from '@mindfiredigital/adac-parser';

// 1. Parse YAML into an AdacConfig AST
const config = parseAdac('my-infra.yaml');

// 2. Initialize the engine
const checker = new ComplianceChecker();

// 3. Evaluate the configuration (reads frameworks dynamically from each service)
const { byService, results, remediationPlan } = checker.checkCompliance(config);

// Retrieve results for a specific service ID
const rdsResults = byService['my-secure-db'];
if (rdsResults) {
  rdsResults.forEach((res) => {
    console.log(`Framework: ${res.framework} - Compliant? ${res.isCompliant}`);
  });
}
```

## Integrating into Renderers

When used in tandem with `@mindfiredigital/adac-core` and its SVG renderer, compliance validations are automatically converted into `<title>` SVG tooltips on the respective infrastructure nodes, allowing you to instantly visualize compliance violations during diagrams generation.
