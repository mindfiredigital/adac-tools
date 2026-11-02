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

function toInt(value: unknown, fallback: number): number {
  return Number.isInteger(value) ? Number(value) : fallback;
}

function normalizePort(port: unknown): Record<string, unknown> | undefined {
  if (typeof port === 'number') return { containerPort: port };

  if (!isRecord(port)) return undefined;

  const containerPort = port.containerPort ?? port.container_port ?? port.port;
  if (typeof containerPort !== 'number') return undefined;

  return {
    name: typeof port.name === 'string' ? port.name : undefined,
    containerPort,
    protocol:
      typeof port.protocol === 'string' ? port.protocol.toUpperCase() : 'TCP',
  };
}

function normalizeEnv(env: unknown): Record<string, unknown>[] | undefined {
  if (Array.isArray(env)) {
    return env
      .filter(isRecord)
      .map((entry) => {
        const normalized: Record<string, unknown> = {
          name: String(entry.name ?? ''),
        };

        if (entry.valueFrom ?? entry.value_from) {
          normalized.valueFrom = entry.valueFrom ?? entry.value_from;
        } else {
          normalized.value = String(entry.value ?? '');
        }

        return normalized;
      })
      .filter((entry) => entry.name);
  }

  if (!isRecord(env)) return undefined;

  return Object.entries(env).map(([name, value]) => ({
    name,
    value: String(value),
  }));
}

function normalizeEnvFrom(
  envFrom: unknown,
  configMapRef: unknown,
  secretRef: unknown
): Record<string, unknown>[] | undefined {
  const refs = Array.isArray(envFrom) ? envFrom.filter(isRecord) : [];

  if (typeof configMapRef === 'string') {
    refs.push({ configMapRef: { name: configMapRef } });
  }

  if (typeof secretRef === 'string') {
    refs.push({ secretRef: { name: secretRef } });
  }

  return refs.length > 0 ? refs : undefined;
}

function normalizeProbe(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;

  const probe: Record<string, unknown> = {};
  const httpGet = value.httpGet ?? value.http_get;
  const tcpSocket = value.tcpSocket ?? value.tcp_socket;
  const initialDelaySeconds =
    value.initialDelaySeconds ?? value.initial_delay_seconds;
  const periodSeconds = value.periodSeconds ?? value.period_seconds;
  const timeoutSeconds = value.timeoutSeconds ?? value.timeout_seconds;
  const failureThreshold = value.failureThreshold ?? value.failure_threshold;
  const successThreshold = value.successThreshold ?? value.success_threshold;

  if (isRecord(httpGet)) {
    probe.httpGet = {
      path: httpGet.path,
      port: httpGet.port,
      host: httpGet.host,
      scheme: httpGet.scheme,
    };
  }

  if (isRecord(tcpSocket)) {
    probe.tcpSocket = {
      port: tcpSocket.port,
      host: tcpSocket.host,
    };
  }

  if (typeof initialDelaySeconds === 'number') {
    probe.initialDelaySeconds = initialDelaySeconds;
  }
  if (typeof periodSeconds === 'number') probe.periodSeconds = periodSeconds;
  if (typeof timeoutSeconds === 'number') probe.timeoutSeconds = timeoutSeconds;
  if (typeof failureThreshold === 'number') {
    probe.failureThreshold = failureThreshold;
  }
  if (typeof successThreshold === 'number') {
    probe.successThreshold = successThreshold;
  }

  return Object.keys(probe).length > 0 ? probe : undefined;
}

function normalizeContainer(
  value: unknown,
  fallbackName: string
): Record<string, unknown> {
  const container = isRecord(value) ? value : {};
  const port = container.port;
  const ports = Array.isArray(container.ports)
    ? container.ports.map(normalizePort).filter(Boolean)
    : [normalizePort(port)].filter(Boolean);

  return {
    name: String(container.name ?? fallbackName),
    image: String(container.image ?? 'nginx:latest'),
    imagePullPolicy: container.imagePullPolicy ?? container.image_pull_policy,
    command: Array.isArray(container.command) ? container.command : undefined,
    args: Array.isArray(container.args) ? container.args : undefined,
    ports: ports.length > 0 ? ports : undefined,
    env: normalizeEnv(container.env),
    envFrom: normalizeEnvFrom(
      container.envFrom ?? container.env_from,
      container.configMapRef ?? container.config_map_ref,
      container.secretRef ?? container.secret_ref
    ),
    resources: isRecord(container.resources) ? container.resources : undefined,
    livenessProbe: normalizeProbe(
      container.livenessProbe ?? container.liveness_probe
    ),
    readinessProbe: normalizeProbe(
      container.readinessProbe ?? container.readiness_probe
    ),
    volumeMounts: Array.isArray(container.volumeMounts)
      ? container.volumeMounts
      : container.volume_mounts,
  };
}

function stripUndefined(
  value: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}

export function createDeploymentManifest(
  service: NormalizedK8sService
): K8sManifest {
  const labels = {
    'app.kubernetes.io/name': service.k8sName,
    'app.kubernetes.io/managed-by': 'adac',
    ...service.tags,
    ...stringRecord(service.config.labels),
  };
  const selectorLabels = stringRecord(service.config.selectorLabels) ??
    stringRecord(service.config.selector_labels) ?? {
      'app.kubernetes.io/name': service.k8sName,
    };
  const rawContainers = Array.isArray(service.config.containers)
    ? service.config.containers
    : [service.config.container];
  const containers = rawContainers.map((container, index) =>
    stripUndefined(
      normalizeContainer(
        container,
        index === 0 ? service.k8sName : `${service.k8sName}-${index + 1}`
      )
    )
  );

  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: stripUndefined({
      name: service.k8sName,
      namespace: service.namespace,
      labels,
      annotations: stringRecord(service.config.annotations),
    }) as unknown as K8sManifest['metadata'],
    spec: {
      replicas: toInt(service.config.replicas, 1),
      selector: { matchLabels: selectorLabels },
      template: {
        metadata: { labels: { ...labels, ...selectorLabels } },
        spec: stripUndefined({
          serviceAccountName: service.config.serviceAccountName,
          containers,
          imagePullSecrets: service.config.imagePullSecrets,
          volumes: service.config.volumes,
        }),
      },
    },
  };
}
