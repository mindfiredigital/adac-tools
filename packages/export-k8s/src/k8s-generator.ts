import yaml from 'js-yaml';
import { parseAdac } from '@mindfiredigital/adac-parser';
import type { AdacConfig } from '@mindfiredigital/adac-validator';
import {
  createConfigMapManifest,
  createSecretManifest,
} from './manifests/configmap.js';
import { createDeploymentManifest } from './manifests/deployment.js';
import { createIngressManifest } from './manifests/ingress.js';
import { createServiceManifest } from './manifests/service.js';
import type {
  K8sFromAdacOptions,
  K8sGenerationOptions,
  K8sGenerationResult,
  K8sManifest,
  K8sWorkloadKind,
  NormalizedK8sService,
} from './types/index.js';

type AdacService =
  AdacConfig['infrastructure']['clouds'][number]['services'][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export class UnsupportedAdacNodeError extends Error {
  readonly nodeId: string;
  readonly nodeType?: string;
  readonly nodeSubtype?: string;
  readonly nodeService?: string;

  constructor(service: AdacService) {
    const nodeId = service.id;
    const details = [
      service.type ? `type "${service.type}"` : undefined,
      service.subtype ? `subtype "${service.subtype}"` : undefined,
      service.service ? `service "${service.service}"` : undefined,
    ].filter((value): value is string => Boolean(value));

    super(
      `Unsupported ADAC node "${nodeId}"${
        details.length > 0 ? ` with ${details.join(', ')}` : ''
      }. Supported Kubernetes node types are deployment, service, ingress, configmap, and secret.`
    );

    this.name = 'UnsupportedAdacNodeError';
    this.nodeId = nodeId;
    this.nodeType = service.type;
    this.nodeSubtype = service.subtype;
    this.nodeService = service.service;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function toK8sName(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');

  return normalized || 'adac-resource';
}

function normalizeKind(service: AdacService): K8sWorkloadKind {
  const candidates = [service.subtype, service.service, service.type]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toLowerCase());

  if (
    candidates.some((value) =>
      ['kubernetes-deployment', 'k8s-deployment', 'deployment'].includes(value)
    )
  ) {
    return 'deployment';
  }

  if (
    candidates.some((value) =>
      ['kubernetes-service', 'k8s-service', 'service'].includes(value)
    )
  ) {
    return 'service';
  }

  if (
    candidates.some((value) =>
      ['kubernetes-ingress', 'k8s-ingress', 'ingress'].includes(value)
    )
  ) {
    return 'ingress';
  }

  if (
    candidates.some((value) =>
      ['kubernetes-configmap', 'configmap', 'config-map'].includes(value)
    )
  ) {
    return 'configmap';
  }

  if (
    candidates.some((value) =>
      ['kubernetes-secret', 'k8s-secret', 'secret'].includes(value)
    )
  ) {
    return 'secret';
  }

  throw new UnsupportedAdacNodeError(service);
}

function normalizeService(
  service: AdacService,
  options: K8sGenerationOptions
): NormalizedK8sService {
  const kind = normalizeKind(service);

  const config = {
    ...(isRecord(service.configuration) ? service.configuration : {}),
    ...(isRecord(service.config) ? service.config : {}),
  };
  const namespace =
    typeof config.namespace === 'string' && config.namespace.length > 0
      ? config.namespace
      : (options.namespace ?? 'default');

  return {
    id: service.id,
    name: service.name,
    type: service.type,
    subtype: service.subtype,
    kind,
    k8sName: toK8sName(String(config.name ?? service.name ?? service.id)),
    namespace: toK8sName(namespace),
    runs: service.runs ?? [],
    config,
    tags: service.tags ?? {},
  };
}

function createNamespaceManifest(namespace: string): K8sManifest {
  return {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
      name: namespace,
      labels: {
        'app.kubernetes.io/managed-by': 'adac',
      },
    },
  };
}

function renderManifest(service: NormalizedK8sService): K8sManifest {
  switch (service.kind) {
    case 'deployment':
      return createDeploymentManifest(service);
    case 'service':
      return createServiceManifest(service);
    case 'ingress':
      return createIngressManifest(service);
    case 'configmap':
      return createConfigMapManifest(service);
    case 'secret':
      return createSecretManifest(service);
  }
}

function manifestWeight(manifest: K8sManifest): number {
  const order = [
    'Namespace',
    'ConfigMap',
    'Secret',
    'Deployment',
    'Service',
    'Ingress',
  ];
  const index = order.indexOf(manifest.kind);
  return index === -1 ? order.length : index;
}

export function renderK8sYaml(manifests: K8sManifest[]): string {
  return `${manifests
    .map((manifest) =>
      yaml.dump(manifest, {
        noRefs: true,
        lineWidth: -1,
        sortKeys: false,
        skipInvalid: false,
      })
    )
    .map((document) => `---\n${document.trimEnd()}`)
    .join('\n')}\n`;
}

export function generateK8sManifests(
  services: AdacService[],
  options: K8sGenerationOptions = {}
): K8sGenerationResult {
  const normalizedServices = services.map((service) =>
    normalizeService(service, options)
  );
  const namespaces = Array.from(
    new Set(normalizedServices.map((service) => service.namespace))
  ).sort();
  const includeNamespaces = options.includeNamespaceManifests ?? true;
  const namespaceManifests = includeNamespaces
    ? namespaces
        .filter((namespace) => namespace !== 'default')
        .map(createNamespaceManifest)
    : [];
  const manifests = [
    ...namespaceManifests,
    ...normalizedServices.map(renderManifest),
  ].sort((a, b) => manifestWeight(a) - manifestWeight(b));

  return {
    yaml: renderK8sYaml(manifests),
    manifests,
    namespaces,
    diagnostics: [
      `Processed ${services.length} services`,
      `Generated ${manifests.length} manifests`,
      `Generated ${namespaceManifests.length} namespaces`,
    ],
  };
}

export function generateK8sManifestsFromAdacConfig(
  adacConfig: AdacConfig,
  options: K8sFromAdacOptions = {}
): K8sGenerationResult {
  const clouds = adacConfig.infrastructure?.clouds ?? [];
  const selectedCloud =
    options.cloudId !== undefined
      ? clouds.find((cloud) => cloud.id === options.cloudId)
      : (clouds.find((cloud) => cloud.provider === 'kubernetes') ?? clouds[0]);

  if (options.cloudId !== undefined && !selectedCloud) {
    throw new Error(
      `Cloud "${options.cloudId}" was not found in infrastructure.clouds.`
    );
  }

  return generateK8sManifests(selectedCloud?.services ?? [], options);
}

export function generateK8sManifestsFromAdacFile(
  filePath: string,
  options: K8sFromAdacOptions = {}
): K8sGenerationResult {
  const adacConfig = parseAdac(filePath, {
    validate: options.validate ?? true,
  });

  return generateK8sManifestsFromAdacConfig(adacConfig, options);
}
