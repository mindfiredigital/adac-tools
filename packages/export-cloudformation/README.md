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

## Example (CLI)

You can also generate a CloudFormation YAML file using the CLI:

```sh
pnpm cli cloudformation ./yamls/aws.adac.yaml -o ./yamls/aws.adac.cfn.yaml --validate
```

This will generate a CloudFormation YAML file from your ADAC YAML definition, with optional validation.
