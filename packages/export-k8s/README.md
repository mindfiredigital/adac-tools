# @mindfiredigital/adac-export-k8s

Generate Kubernetes manifests from ADAC architecture definitions.

## Features

- Deployment, Service, and Ingress manifest generation
- ConfigMap and Secret generation
- Namespace manifests for non-default namespaces
- Multi-document Kubernetes YAML output
- Raw manifest objects for testing or post-processing

## Usage

## Run Standalone

This package exposes the `adac-export-k8s` binary.

After installing the package:

```bash
adac-export-k8s architecture.adac.yaml --namespace default --output ./k8s-out
```

From the monorepo root:

```bash
pnpm --filter @mindfiredigital/adac-export-k8s build
node packages/export-k8s/dist/cli.js yamls/kubernetes.adac.yaml --namespace default --output ./k8s-out
```

If `--output` is omitted, the generated manifests are printed to stdout.

## Programmatic Usage

```ts
import { generateK8sManifestsFromAdacFile } from '@mindfiredigital/adac-export-k8s';

// Validation is enabled by default. To disable validation, pass { validate: false } as the second argument.
const result = generateK8sManifestsFromAdacFile('architecture.adac.yaml');

console.log(result.yaml);
```

## ADAC Example

```yaml
version: '0.1'
metadata:
  name: 'Kubernetes App'
  created: '2026-01-05'
infrastructure:
  clouds:
    - id: 'k8s'
      provider: 'kubernetes'
      region: 'prod-cluster'
      services:
        - id: 'api-deployment'
          type: 'compute'
          subtype: 'kubernetes-deployment'
          config:
            namespace: 'api'
            replicas: 2
            container:
              name: 'api'
              image: 'example/api:1.0.0'
              port: 8080

        - id: 'api-service'
          type: 'network'
          subtype: 'kubernetes-service'
          config:
            namespace: 'api'
            selector: 'api-deployment'
            port: 80
            target_port: 8080
```

## API

### `generateK8sManifestsFromAdacFile(filePath, options?)`

Parses an ADAC YAML file and returns Kubernetes manifests.

### `generateK8sManifestsFromAdacConfig(adacConfig, options?)`

Generates manifests from an already parsed ADAC config.

### `generateK8sManifests(services, options?)`

Generates manifests from a list of ADAC services.

## Options

- `cloudId` (`string | undefined`, default: `undefined`): select a specific cloud entry; when omitted, the first Kubernetes cloud is used, falling back to the first cloud.
- `namespace` (`string`, default: `"default"`): default namespace used when a service does not define one.
- `includeNamespaceManifests` (`boolean`, default: `true`): include Namespace documents for non-default namespaces.
- `validate` (`boolean`, default: `true`): enable ADAC schema validation when parsing files.
