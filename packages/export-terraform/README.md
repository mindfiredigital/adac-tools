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

This package is also wired into the ADAC CLI as a standalone Terraform
generation command:

```powershell
pnpm cli terraform .\yamls\aws.adac.yaml
```

To choose a custom output directory:

```powershell
pnpm cli terraform .\yamls\aws.adac.yaml --output .\temp-terraform-output
```

This generates:

- `main.tf`
- `variables.tf`
- `outputs.tf`

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
