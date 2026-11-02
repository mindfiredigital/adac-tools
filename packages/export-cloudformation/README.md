# @mindfiredigital/adac-export-cloudformation

Generate AWS CloudFormation YAML from ADAC architecture definitions.

## Public API

- `generateCloudFormationFromServices(services, options)`
- `generateCloudFormationFromAdacConfig(adacConfig, options)`
- `generateCloudFormationFromAdacContent(content, options)`
- `generateCloudFormationFromAdacFile(filePath, options)`

## Current Scope

Current implementation covers:

- ADAC normalization
- base CloudFormation template generation
- AWS networking mapping:
  - VPC
  - subnet
  - security group
  - application load balancer
- AWS compute mapping:
  - EC2
  - ECS Fargate
  - Lambda
- AWS database mapping:
  - RDS Postgres
  - DynamoDB
- parameter generation for reusable and sensitive inputs
- outputs for key AWS resources

The test suite also includes an optional `cfn-lint` validation check when
`cfn-lint` is installed in the local environment.

## Example

```ts
import { generateCloudFormationFromAdacFile } from '@mindfiredigital/adac-export-cloudformation';

const result = generateCloudFormationFromAdacFile('./yamls/aws.adac.yaml');
console.log(result.templateYaml);
```

## Run Standalone

This package exposes the `adac-export-cloudformation` binary.

After installing the package:

```sh
adac-export-cloudformation architecture.adac.yaml --output ./cloudformation-out
```

From the monorepo root:

```sh
pnpm --filter @mindfiredigital/adac-export-cloudformation build
node packages/export-cloudformation/dist/cli.js yamls/aws.adac.yaml --output ./cloudformation-out
```

This generates `<input-name>.cfn.yaml` in the output directory. If `--output`
is omitted, the generated template is printed to stdout.
