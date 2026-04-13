import { describe, it, expect } from 'vitest';
import { requireLoggingRule } from '../../src/rules/logging-rules';
import { AdacConfig } from '@mindfiredigital/adac-schema';

type AdacService = AdacConfig['infrastructure']['clouds'][0]['services'][0];

const makeContext = (): { config: AdacConfig } => ({
  config: {
    version: '0.1',
    metadata: { name: 'Test', created: '2026-01-01' },
    infrastructure: { clouds: [] },
  },
});

describe('requireLoggingRule (log-01)', () => {
  it('should be registered with correct metadata', () => {
    expect(requireLoggingRule.id).toBe('log-01');
    expect(requireLoggingRule.frameworks).toContain('pci-dss');
    expect(requireLoggingRule.frameworks).toContain('soc2');
    expect(requireLoggingRule.frameworks).toContain('hipaa');
    expect(requireLoggingRule.frameworks).toContain('iso27001');
    expect(requireLoggingRule.frameworks).toContain('fedramp');
    expect(requireLoggingRule.severity).toBe('medium');
  });

  it('should return null for non-logging-required services', () => {
    const service: AdacService = { id: 'rds-1', service: 'rds' };
    expect(requireLoggingRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should return a violation for s3 without logging', () => {
    const service: AdacService = {
      id: 'bucket-1',
      service: 's3',
      config: {},
    } as unknown as AdacService;
    const result = requireLoggingRule.evaluate(service, makeContext());
    expect(result).not.toBeNull();
    expect(result?.id).toBe('log-01');
    expect(result?.severity).toBe('medium');
  });

  it('should return null for s3 with loggingEnabled: true', () => {
    const service: AdacService = {
      id: 'bucket-logged',
      service: 's3',
      config: { loggingEnabled: true },
    } as unknown as AdacService;
    expect(requireLoggingRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should return null for s3 with accessLogs configured', () => {
    const service: AdacService = {
      id: 'bucket-access-logs',
      service: 's3',
      config: { accessLogs: { bucket: 'logs-bucket', prefix: 'access/' } },
    } as unknown as AdacService;
    expect(requireLoggingRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should return a violation for alb without logging', () => {
    const service: AdacService = {
      id: 'alb-1',
      service: 'alb',
      config: {},
    } as unknown as AdacService;
    const result = requireLoggingRule.evaluate(service, makeContext());
    expect(result?.id).toBe('log-01');
  });

  it('should return a violation for api-gateway without logging', () => {
    const service: AdacService = {
      id: 'apigw-1',
      service: 'api-gateway',
    } as unknown as AdacService;
    const result = requireLoggingRule.evaluate(service, makeContext());
    expect(result?.id).toBe('log-01');
  });

  it('should check all loggable service types', () => {
    const loggableServices = [
      'alb',
      'api-gateway',
      's3',
      'cloudfront',
      'cloud-load-balancing',
      'cloud-storage',
      'gcs',
      'cloud-cdn',
    ];
    for (const svc of loggableServices) {
      const service: AdacService = {
        id: `${svc}-test`,
        service: svc,
      } as unknown as AdacService;
      const result = requireLoggingRule.evaluate(service, makeContext());
      expect(result?.id).toBe('log-01');
    }
  });

  it('should include remediation steps', () => {
    const service: AdacService = {
      id: 'alb-nolog',
      service: 'alb',
    } as unknown as AdacService;
    const result = requireLoggingRule.evaluate(service, makeContext());
    expect(result?.remediation.id).toBe('rem-log-01');
    expect(result?.remediation.actionableSteps.length).toBeGreaterThan(0);
  });

  it('should use service name in violation message when available', () => {
    const service: AdacService = {
      id: 'my-alb',
      name: 'Production ALB',
      service: 'alb',
    } as unknown as AdacService;
    const result = requireLoggingRule.evaluate(service, makeContext());
    expect(result?.message).toContain('Production ALB');
  });

  it('should fall back to service id in message when name is absent', () => {
    const service: AdacService = {
      id: 'my-alb-id',
      service: 'alb',
    } as unknown as AdacService;
    const result = requireLoggingRule.evaluate(service, makeContext());
    expect(result?.message).toContain('my-alb-id');
  });
});
