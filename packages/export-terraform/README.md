# @mindfiredigital/adac-export-terraform

Generate Terraform configuration from ADAC architecture definitions.

## What It Does

This package converts ADAC services into Terraform HCL and returns three
generated file contents:

- `mainTf`
- `variablesTf`
- `outputsTf`

It is designed for file-based generation from ADAC YAML.

## CLI Usage

## Run Standalone

This package exposes the `adac-export-terraform` binary.

After installing the package:

```bash
adac-export-terraform architecture.adac.yaml --output ./terraform-out
```

From the monorepo root:

```bash
pnpm --filter @mindfiredigital/adac-export-terraform build
node packages/export-terraform/dist/cli.js yamls/aws.adac.yaml --output ./temp-terraform-output
```

It is also wired into the main ADAC CLI:

```powershell
pnpm cli terraform .\yamls\aws.adac.yaml
```

To choose a custom output directory:

```powershell
pnpm cli terraform .\yamls\aws.adac.yaml --output .\temp-terraform-output
```

This generates:

- Standalone package binary: `<input-name>.tf`
- Main ADAC CLI: `main.tf`, `variables.tf`, and `outputs.tf`

## Module Support

If a service includes:

```yaml
config:
  module:
    source: 'terraform-aws-modules/vpc/aws'
    inputs:
      name: 'main-vpc'
      cidr: '10.0.0.0/16'
```

the exporter will generate a Terraform `module` block instead of the normal
resource mapping for that service.

To pass a raw Terraform expression into a module input, wrap it like this:

```yaml
config:
  module:
    source: 'terraform-aws-modules/security-group/aws'
    inputs:
      vpc_id:
        terraform: 'aws_vpc.vpc_main.id'
```
