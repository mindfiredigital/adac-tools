import { describe, it, expect } from 'vitest';
import { requireMonitoringRule } from '../../src/rules/monitoring-rules';
import { AdacConfig } from '@mindfiredigital/adac-schema';

type AdacService = AdacConfig['infrastructure']['clouds'][0]['services'][0];

const makeContext = (): { config: AdacConfig } => ({
  config: {
    version: '0.1',
    metadata: { name: 'Test', created: '2026-01-01' },
    infrastructure: { clouds: [] },
  },
});

describe('requireMonitoringRule (mon-01)', () => {
  it('should be registered with correct metadata', () => {
    expect(requireMonitoringRule.id).toBe('mon-01');
    expect(requireMonitoringRule.frameworks).toContain('soc2');
    expect(requireMonitoringRule.frameworks).toContain('iso27001');
    expect(requireMonitoringRule.severity).toBe('medium');
  });

  it('should return null for non-compute services', () => {
    const service: AdacService = { id: 's3-1', service: 's3' };
    expect(requireMonitoringRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should return a violation for ec2 with no monitoring', () => {
    const service: AdacService = {
      id: 'ec2-1',
      service: 'ec2',
    } as unknown as AdacService;
    const result = requireMonitoringRule.evaluate(service, makeContext());
    expect(result).not.toBeNull();
    expect(result?.id).toBe('mon-01');
    expect(result?.resourceId).toBe('ec2-1');
    expect(result?.severity).toBe('medium');
  });

  it('should return a violation for ec2 with monitoring.enabled: false', () => {
    const service: AdacService = {
      id: 'ec2-disabled-mon',
      service: 'ec2',
      monitoring: { enabled: false },
    } as unknown as AdacService;
    const result = requireMonitoringRule.evaluate(service, makeContext());
    expect(result?.id).toBe('mon-01');
  });

  it('should return null for ec2 with monitoring.enabled: true', () => {
    const service: AdacService = {
      id: 'ec2-monitored',
      service: 'ec2',
      monitoring: { enabled: true },
    } as unknown as AdacService;
    expect(requireMonitoringRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should return a violation for rds with no monitoring', () => {
    const service: AdacService = {
      id: 'rds-unmonitored',
      service: 'rds',
    } as unknown as AdacService;
    const result = requireMonitoringRule.evaluate(service, makeContext());
    expect(result?.id).toBe('mon-01');
  });

  it('should check all compute service types', () => {
    const computeServices = [
      'ec2',
      'rds',
      'ecs',
      'compute-engine',
      'gce',
      'cloud-sql',
      'cloudsql',
      'gke',
      'cloud-run',
    ];
    for (const svc of computeServices) {
      const service: AdacService = {
        id: `${svc}-test`,
        service: svc,
      } as unknown as AdacService;
      const result = requireMonitoringRule.evaluate(service, makeContext());
      expect(result?.id).toBe('mon-01');
    }
  });

  it('should return null for GCP compute-engine with monitoring enabled', () => {
    const service: AdacService = {
      id: 'gce-monitored',
      service: 'compute-engine',
      monitoring: { enabled: true },
    } as unknown as AdacService;
    expect(requireMonitoringRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should include remediation steps referencing the resource id', () => {
    const service: AdacService = {
      id: 'prod-ec2',
      service: 'ec2',
    } as unknown as AdacService;
    const result = requireMonitoringRule.evaluate(service, makeContext());
    expect(result?.remediation.id).toBe('rem-mon-01');
    expect(result?.remediation.actionableSteps[0]).toContain('prod-ec2');
  });

  it('should use service name in violation message when available', () => {
    const service: AdacService = {
      id: 'my-ec2',
      name: 'Web Server',
      service: 'ec2',
    } as unknown as AdacService;
    const result = requireMonitoringRule.evaluate(service, makeContext());
    expect(result?.message).toContain('Web Server');
  });

  it('should fall back to id in message when name is absent', () => {
    const service: AdacService = {
      id: 'my-ec2-id',
      service: 'ec2',
    } as unknown as AdacService;
    const result = requireMonitoringRule.evaluate(service, makeContext());
    expect(result?.message).toContain('my-ec2-id');
  });
});
