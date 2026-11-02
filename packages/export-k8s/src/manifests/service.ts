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

function toK8sName(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');

  return normalized || 'adac-service';
}

function normalizePort(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'number') {
    return { port: value, targetPort: value, protocol: 'TCP' };
  }

  if (!isRecord(value)) return undefined;

  const port = value.port;
  if (typeof port !== 'number') return undefined;

  return {
    name: typeof value.name === 'string' ? value.name : undefined,
    port,
    targetPort: value.targetPort ?? value.target_port ?? port,
    protocol:
      typeof value.protocol === 'string' ? value.protocol.toUpperCase() : 'TCP',
  };
}

function stripUndefined(
  value: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}

export function createServiceManifest(
  service: NormalizedK8sService
): K8sManifest {
  const ports = Array.isArray(service.config.ports)
    ? service.config.ports.map(normalizePort).filter(Boolean)
    : [
        normalizePort({
          port: service.config.port ?? 80,
          targetPort:
            service.config.targetPort ??
            service.config.target_port ??
            service.config.port ??
            80,
          protocol: service.config.protocol,
          name: service.config.port_name,
        }),
      ].filter(Boolean);
  const selector =
    stringRecord(service.config.selector) ??
    stringRecord(service.config.selectorLabels) ??
    stringRecord(service.config.selector_labels) ??
    (typeof service.config.selector === 'string'
      ? { 'app.kubernetes.io/name': toK8sName(service.config.selector) }
      : { 'app.kubernetes.io/name': service.k8sName });

  return {
    apiVersion: 'v1',
    kind: 'Service',
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
    spec: stripUndefined({
      type:
        service.config.serviceType ??
        service.config.service_type ??
        'ClusterIP',
      selector,
      ports,
    }),
  };
}
