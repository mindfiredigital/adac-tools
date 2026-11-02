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

function backend(serviceName: unknown, port: unknown): Record<string, unknown> {
  const parsedPort = Number(port ?? 80);
  const portNumber =
    Number.isFinite(parsedPort) && Number.isInteger(parsedPort)
      ? parsedPort
      : 80;

  return {
    service: {
      name: toK8sName(String(serviceName)),
      port: typeof port === 'string' ? { name: port } : { number: portNumber },
    },
  };
}

function normalizeRule(rule: unknown): Record<string, unknown> | undefined {
  if (!isRecord(rule)) return undefined;

  const paths = Array.isArray(rule.paths) ? rule.paths.filter(isRecord) : [];

  return {
    host: rule.host,
    http: {
      paths: paths.map((path) => ({
        path: path.path ?? '/',
        pathType: path.pathType ?? path.path_type ?? 'Prefix',
        backend: backend(path.service ?? path.serviceName, path.port),
      })),
    },
  };
}

function stripUndefined(
  value: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}

export function createIngressManifest(
  service: NormalizedK8sService
): K8sManifest {
  const rules = Array.isArray(service.config.rules)
    ? service.config.rules.map(normalizeRule).filter(Boolean)
    : [];
  const defaultBackend = isRecord(service.config.defaultBackend)
    ? service.config.defaultBackend
    : service.config.default_backend;

  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
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
      ingressClassName:
        service.config.ingressClassName ?? service.config.ingress_class,
      tls: service.config.tls,
      defaultBackend: isRecord(defaultBackend)
        ? backend(defaultBackend.service, defaultBackend.port)
        : undefined,
      rules,
    }),
  };
}
