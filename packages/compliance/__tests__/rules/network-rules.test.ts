import { describe, it, expect } from 'vitest';
import { requirePrivateSubnetsRule } from '../../src/rules/network-rules';
import { AdacConfig } from '@mindfiredigital/adac-schema';

type AdacService = AdacConfig['infrastructure']['clouds'][0]['services'][0];

const makeContext = (): { config: AdacConfig } => ({
  config: {
    version: '0.1',
    metadata: { name: 'Test', created: '2026-01-01' },
    infrastructure: { clouds: [] },
  },
});

describe('requirePrivateSubnetsRule (net-01)', () => {
  it('should be registered with correct metadata', () => {
    expect(requirePrivateSubnetsRule.id).toBe('net-01');
    expect(requirePrivateSubnetsRule.frameworks).toContain('pci-dss');
    expect(requirePrivateSubnetsRule.frameworks).toContain('soc2');
    expect(requirePrivateSubnetsRule.frameworks).toContain('iso27001');
    expect(requirePrivateSubnetsRule.severity).toBe('critical');
  });

  it('should return null for non-database services', () => {
    const service: AdacService = { id: 'ec2-1', service: 'ec2' };
    expect(
      requirePrivateSubnetsRule.evaluate(service, makeContext())
    ).toBeNull();
  });

  it('should return a violation for publicly accessible RDS', () => {
    const service: AdacService = {
      id: 'rds-public',
      service: 'rds',
      config: { publiclyAccessible: true },
    } as unknown as AdacService;
    const result = requirePrivateSubnetsRule.evaluate(service, makeContext());
    expect(result).not.toBeNull();
    expect(result?.id).toBe('net-01');
    expect(result?.resourceId).toBe('rds-public');
    expect(result?.severity).toBe('critical');
  });

  it('should return null for private RDS', () => {
    const service: AdacService = {
      id: 'rds-private',
      service: 'rds',
      config: { publiclyAccessible: false },
    } as unknown as AdacService;
    expect(
      requirePrivateSubnetsRule.evaluate(service, makeContext())
    ).toBeNull();
  });

  it('should return a violation for public subnet type', () => {
    const service: AdacService = {
      id: 'db-public-subnet',
      service: 'dynamodb',
      config: { subnetType: 'public' },
    } as unknown as AdacService;
    const result = requirePrivateSubnetsRule.evaluate(service, makeContext());
    expect(result).not.toBeNull();
    expect(result?.id).toBe('net-01');
  });

  it('should return a violation for GCP cloud-sql with public_ip_enabled', () => {
    const service: AdacService = {
      id: 'sql-public',
      service: 'cloud-sql',
      configuration: { public_ip_enabled: true },
    } as unknown as AdacService;
    const result = requirePrivateSubnetsRule.evaluate(service, makeContext());
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('critical');
  });

  it('should return null for GCP cloud-sql without public access', () => {
    const service: AdacService = {
      id: 'sql-private',
      service: 'cloud-sql',
      configuration: { public_ip_enabled: false },
    } as unknown as AdacService;
    expect(
      requirePrivateSubnetsRule.evaluate(service, makeContext())
    ).toBeNull();
  });

  it('should include remediation with two actionable steps', () => {
    const service: AdacService = {
      id: 'rds-exposed',
      service: 'rds',
      config: { publiclyAccessible: true },
    } as unknown as AdacService;
    const result = requirePrivateSubnetsRule.evaluate(service, makeContext());
    expect(result?.remediation.id).toBe('rem-net-01');
    expect(result?.remediation.actionableSteps.length).toBe(2);
    expect(result?.remediation.references.length).toBeGreaterThan(0);
  });

  it('should check all database service types', () => {
    const dbServices = [
      'rds',
      'dynamodb',
      'databases',
      'cloud-sql',
      'cloudsql',
      'cloud-spanner',
      'firestore',
      'bigtable',
    ];
    for (const svc of dbServices) {
      const service: AdacService = {
        id: `${svc}-test`,
        service: svc,
        config: { publiclyAccessible: true },
      } as unknown as AdacService;
      const result = requirePrivateSubnetsRule.evaluate(service, makeContext());
      expect(result?.id).toBe('net-01');
    }
  });

  it('should use service name in message when name is provided', () => {
    const service: AdacService = {
      id: 'prod-db',
      name: 'Production DB',
      service: 'rds',
      config: { publiclyAccessible: true },
    } as unknown as AdacService;
    const result = requirePrivateSubnetsRule.evaluate(service, makeContext());
    expect(result?.message).toContain('Production DB');
  });

  it('should treat missing DB network config as a security violation', () => {
    const service: AdacService = {
      id: 'rds-default',
      service: 'rds',
      config: {},
    } as unknown as AdacService;
    const result = requirePrivateSubnetsRule.evaluate(service, makeContext());
    expect(result).not.toBeNull();
    expect(result?.id).toBe('net-01');
  });
});
