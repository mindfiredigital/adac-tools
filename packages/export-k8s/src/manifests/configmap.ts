import type { K8sManifest, NormalizedK8sService } from '../types/index.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, String(entry)])
  );
}

function stripUndefined(
  value: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}

export function createConfigMapManifest(
  service: NormalizedK8sService
): K8sManifest {
  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: stripUndefined({
      name: service.k8sName,
      namespace: service.namespace,
      labels: {
        'app.kubernetes.io/name': service.k8sName,
        'app.kubernetes.io/managed-by': 'adac',
        ...service.tags,
        ...stringRecord(service.config.labels),
      },
      annotations: stringRecord(service.config.annotations),
    }) as unknown as K8sManifest['metadata'],
    data: stringRecord(service.config.data) ?? {},
    binaryData: stringRecord(
      service.config.binaryData ?? service.config.binary_data
    ),
    immutable:
      typeof service.config.immutable === 'boolean'
        ? service.config.immutable
        : undefined,
  };
}

export function createSecretManifest(
  service: NormalizedK8sService
): K8sManifest {
  const encodedData = service.config.encodedData ?? service.config.encoded_data;
  const stringData =
    service.config.stringData ??
    service.config.string_data ??
    service.config.data;

  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: stripUndefined({
      name: service.k8sName,
      namespace: service.namespace,
      labels: {
        'app.kubernetes.io/name': service.k8sName,
        'app.kubernetes.io/managed-by': 'adac',
        ...service.tags,
        ...stringRecord(service.config.labels),
      },
      annotations: stringRecord(service.config.annotations),
    }) as unknown as K8sManifest['metadata'],
    type: service.config.secretType ?? service.config.secret_type ?? 'Opaque',
    data: stringRecord(encodedData),
    stringData: stringRecord(stringData),
    immutable:
      typeof service.config.immutable === 'boolean'
        ? service.config.immutable
        : undefined,
  };
}
