import { describe, expect, it } from 'vitest';
import { createIngressManifest } from '../src/manifests/ingress.js';
import type { NormalizedK8sService } from '../src/types/index.js';

function ingressService(config: Record<string, unknown>): NormalizedK8sService {
  return {
    id: 'web-ingress',
    kind: 'ingress',
    k8sName: 'web-ingress',
    namespace: 'default',
    runs: [],
    config,
    tags: {},
  };
}

describe('createIngressManifest', () => {
  it('uses only valid backend port numbers', () => {
    const manifest = createIngressManifest(
      ingressService({
        rules: [
          {
            paths: [
              { service: 'web', port: 8080 },
              { service: 'admin', port: Number.NaN },
              { service: 'api', port: 443.5 },
              { service: 'metrics', port: 'http' },
            ],
          },
        ],
      })
    );

    const rules = manifest.spec?.rules as Array<{
      http: { paths: Array<{ backend: { service: { port: unknown } } }> };
    }>;
    const ports = rules[0].http.paths.map((path) => path.backend.service.port);

    expect(ports).toEqual([
      { number: 8080 },
      { number: 80 },
      { number: 80 },
      { name: 'http' },
    ]);
  });
});
