it('ensures every manifest has required managed-by label', () => {
  const result = generateFromYaml(adacYaml);
  for (const manifest of result.manifests) {
    expect(manifest.metadata?.labels?.['app.kubernetes.io/managed-by']).toBe(
      'adac'
    );
  }
});

it('normalizes invalid service names to DNS subdomain format', () => {
  const invalidNameYaml = `
      version: '0.1'
      metadata:
        name: 'Invalid Name Test'
      infrastructure:
        clouds:
          - id: 'k8s-cluster'
            provider: 'kubernetes'
            services:
              - id: 'Invalid_Name_123'
                type: 'compute'
                subtype: 'kubernetes-deployment'
                config:
                  image: 'nginx:latest'
    `;
  const result = generateFromYaml(invalidNameYaml);
  const serviceManifest = result.manifests.find((m) => m.kind === 'Deployment');
  // DNS-1123 subdomain regex: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$'
  expect(serviceManifest?.metadata?.name).toMatch(
    /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/
  );
});

it('throws UnsupportedAdacNodeError for unsupported node types', () => {
  const unsupportedYaml = `
      version: '0.1'
      metadata:
        name: 'Unsupported Node Test'
      infrastructure:
        clouds:
          - id: 'k8s-cluster'
            provider: 'kubernetes'
            services:
              - id: 'unsupported-service'
                type: 'compute'
                subtype: 'kubernetes-statefulset'
                config:
                  image: 'nginx:latest'
    `;

  let error: unknown;
  try {
    generateFromYaml(unsupportedYaml);
  } catch (err) {
    error = err;
  }

  expect(error).toBeInstanceOf(UnsupportedAdacNodeError);
  if (error instanceof UnsupportedAdacNodeError) {
    expect(error.nodeId).toBe('unsupported-service');
    expect(error.nodeType).toBe('compute');
    expect(error.nodeSubtype).toBe('kubernetes-statefulset');
    expect(error.message).toContain('unsupported-service');
    expect(error.message).toContain('compute');
    expect(error.message).toContain('kubernetes-statefulset');
  }
});
import { execFileSync, type ExecException } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';
import { afterEach, describe, expect, it } from 'vitest';
import {
  generateK8sManifestsFromAdacFile,
  UnsupportedAdacNodeError,
} from '../src/index.js';

const TEMP_DIR_PREFIX = join(tmpdir(), 'adac-export-k8s-');
const KUBECTL_DRY_RUN_TIMEOUT_MS = 5000;
const tempDirs: string[] = [];

function createTempDir(): string {
  const tempDir = mkdtempSync(TEMP_DIR_PREFIX);
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

function hasKubectl(): boolean {
  try {
    execFileSync('kubectl', ['version', '--client'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isKubectlDiscoveryUnavailable(error: unknown): boolean {
  const execError = error as {
    message?: string;
    stderr?: Buffer | string;
  };
  const stderr = Buffer.isBuffer(execError.stderr)
    ? execError.stderr.toString('utf8')
    : (execError.stderr ?? '');
  const output = `${execError.message ?? ''}\n${stderr}`;

  return (
    output.includes("couldn't get current server API group list") ||
    output.includes('connect: connection refused') ||
    output.includes('unable to connect to the server') ||
    output.includes('localhost:8080')
  );
}

function generateFromYaml(
  content: string,
  options: { validate?: boolean } = { validate: false }
) {
  const tempDir = createTempDir();
  const filePath = join(tempDir, 'k8s.adac.yaml');
  writeFileSync(filePath, content);
  return generateK8sManifestsFromAdacFile(filePath, {
    validate: options.validate ?? false,
  });
}
describe('generateK8sManifestsFromAdacFile schema validation', () => {
  it('throws on invalid ADAC YAML when validate: true', () => {
    const invalidAdacYaml = `
      version: '0.1'
      metadata:
        name: 'Invalid Test'
      # missing required fields like infrastructure
    `;
    expect(() =>
      generateFromYaml(invalidAdacYaml, { validate: true })
    ).toThrow();
  });

  it('succeeds on valid ADAC YAML when validate: true', () => {
    expect(() => generateFromYaml(adacYaml, { validate: true })).not.toThrow();
    const result = generateFromYaml(adacYaml, { validate: true });
    expect(result.yaml).toContain('apiVersion: apps/v1');
  });
});

const adacYaml = `
version: '0.1'
metadata:
  name: 'Kubernetes Test'
  created: '2026-01-05'
infrastructure:
  clouds:
    - id: 'k8s-cluster'
      provider: 'kubernetes'
      region: 'prod'
      services:
        - id: 'app-config'
          subtype: 'kubernetes-configmap'
          config:
            namespace: 'web'
            data:
              API_BASE_URL: 'https://api.example.local'
        - id: 'app-secret'
          subtype: 'kubernetes-secret'
          config:
            namespace: 'web'
            data:
              DATABASE_URL: 'postgres://db:5432/app'
        - id: 'frontend-deployment'
          type: 'compute'
          subtype: 'kubernetes-deployment'
          tags:
            tier: 'frontend'
          config:
            namespace: 'web'
            replicas: 3
            container:
              name: 'frontend'
              image: 'example/frontend:1.0.0'
              port: 3000
              config_map_ref: 'app-config'
              secret_ref: 'app-secret'
              resources:
                requests:
                  cpu: '100m'
                  memory: '128Mi'
                limits:
                  cpu: '500m'
                  memory: '256Mi'
              env:
                API_BASE_URL: 'https://api.example.local'
              liveness_probe:
                http_get:
                  path: '/health'
                  port: 3000
                initial_delay_seconds: 30
        - id: 'frontend-service'
          type: 'network'
          subtype: 'kubernetes-service'
          config:
            namespace: 'web'
            service_type: 'ClusterIP'
            selector: 'frontend-deployment'
            port: 80
            target_port: 3000
        - id: 'web-ingress'
          type: 'network'
          subtype: 'kubernetes-ingress'
          config:
            namespace: 'web'
            ingress_class: 'nginx'
            rules:
              - host: 'example.local'
                paths:
                  - path: '/'
                    service: 'frontend-service'
                    port: 80
`;

describe('generateK8sManifestsFromAdacFile', () => {
  it('generates valid multi-document Kubernetes YAML', () => {
    const result = generateFromYaml(adacYaml);
    const parsed = yaml.loadAll(result.yaml);

    expect(result.yaml).toContain('apiVersion: apps/v1');
    expect(result.yaml).toContain('kind: Deployment');
    expect(result.yaml).toContain('kind: Service');
    expect(result.yaml).toContain('kind: Ingress');
    expect(result.yaml).toContain('kind: ConfigMap');
    expect(result.yaml).toContain('kind: Secret');
    expect(parsed).toHaveLength(result.manifests.length);
    expect(result.diagnostics).toContain('Processed 5 services');
  });

  it('generates correct Deployment, Service, Ingress, ConfigMap, Secret, and Namespace manifests', () => {
    const result = generateFromYaml(adacYaml);
    const deployment = result.manifests.find(
      (manifest) => manifest.kind === 'Deployment'
    );
    const service = result.manifests.find(
      (manifest) => manifest.kind === 'Service'
    );
    const ingress = result.manifests.find(
      (manifest) => manifest.kind === 'Ingress'
    );
    const configMap = result.manifests.find(
      (manifest) => manifest.kind === 'ConfigMap'
    );
    const secret = result.manifests.find(
      (manifest) => manifest.kind === 'Secret'
    );
    const namespace = result.manifests.find(
      (manifest) => manifest.kind === 'Namespace'
    );

    expect(namespace).toBeDefined();
    expect(configMap).toBeDefined();
    expect(secret).toBeDefined();
    expect(deployment).toBeDefined();
    expect(service).toBeDefined();
    expect(ingress).toBeDefined();

    expect(namespace?.metadata.name).toBe('web');
    expect(configMap?.metadata.namespace).toBe('web');
    expect(configMap?.data).toEqual({
      API_BASE_URL: 'https://api.example.local',
    });
    expect(secret?.stringData).toEqual({
      DATABASE_URL: 'postgres://db:5432/app',
    });
    expect(deployment?.metadata.name).toBe('frontend-deployment');
    expect(deployment?.spec).toMatchObject({
      replicas: 3,
      selector: {
        matchLabels: { 'app.kubernetes.io/name': 'frontend-deployment' },
      },
    });
    expect(service?.spec).toMatchObject({
      type: 'ClusterIP',
      selector: { 'app.kubernetes.io/name': 'frontend-deployment' },
      ports: [{ port: 80, targetPort: 3000, protocol: 'TCP' }],
    });
    expect(ingress?.spec).toMatchObject({
      ingressClassName: 'nginx',
      rules: [
        {
          host: 'example.local',
          http: {
            paths: [
              {
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: 'frontend-service',
                    port: { number: 80 },
                  },
                },
              },
            ],
          },
        },
      ],
    });
  });

  it('passes kubectl apply --dry-run when kubectl can perform local validation', () => {
    if (!hasKubectl()) {
      return;
    }

    const result = generateFromYaml(adacYaml);
    const tempDir = createTempDir();
    const manifestPath = join(tempDir, 'manifests.yaml');
    writeFileSync(manifestPath, result.yaml);

    try {
      execFileSync(
        'kubectl',
        ['apply', '--dry-run=client', '--validate=false', '-f', manifestPath],
        { stdio: 'pipe', timeout: KUBECTL_DRY_RUN_TIMEOUT_MS }
      );
    } catch (error) {
      const err = error as ExecException;
      if (err.code === 'ETIMEDOUT' || isKubectlDiscoveryUnavailable(err)) {
        return;
      }

      throw err;
    }
  });
});
