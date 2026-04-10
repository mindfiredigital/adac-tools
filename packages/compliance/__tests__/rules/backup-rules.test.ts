import { describe, it, expect } from 'vitest';
import { requireBackupRule } from '../../src/rules/backup-rules';
import { AdacConfig } from '@mindfiredigital/adac-schema';

type AdacService = AdacConfig['infrastructure']['clouds'][0]['services'][0];

const makeContext = (): { config: AdacConfig } => ({
  config: {
    version: '0.1',
    metadata: { name: 'Test', created: '2026-01-01' },
    infrastructure: { clouds: [] },
  },
});

describe('requireBackupRule (bck-01)', () => {
  it('should be registered with correct metadata', () => {
    expect(requireBackupRule.id).toBe('bck-01');
    expect(requireBackupRule.frameworks).toContain('pci-dss');
    expect(requireBackupRule.frameworks).toContain('soc2');
    expect(requireBackupRule.frameworks).toContain('hipaa');
    expect(requireBackupRule.frameworks).toContain('iso27001');
    expect(requireBackupRule.severity).toBe('high');
  });

  it('should return null for non-database services', () => {
    const service: AdacService = { id: 'ec2-1', service: 'ec2' };
    expect(requireBackupRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should return null for s3 (not a database)', () => {
    const service: AdacService = { id: 's3-1', service: 's3' };
    expect(requireBackupRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should return a violation for rds with backupRetentionPeriod: 0', () => {
    const service: AdacService = {
      id: 'rds-no-backup',
      service: 'rds',
      config: { backupRetentionPeriod: 0 },
    } as unknown as AdacService;
    const result = requireBackupRule.evaluate(service, makeContext());
    expect(result).not.toBeNull();
    expect(result?.id).toBe('bck-01');
    expect(result?.resourceId).toBe('rds-no-backup');
    expect(result?.severity).toBe('high');
  });

  it('should return null for rds with backupRetentionPeriod > 0', () => {
    const service: AdacService = {
      id: 'rds-backed-up',
      service: 'rds',
      config: { backupRetentionPeriod: 7 },
    } as unknown as AdacService;
    expect(requireBackupRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should return a violation for rds with no backup config at all', () => {
    const service: AdacService = {
      id: 'rds-bare',
      service: 'rds',
      config: {},
    } as unknown as AdacService;
    const result = requireBackupRule.evaluate(service, makeContext());
    expect(result?.id).toBe('bck-01');
  });

  it('should return null when backup_enabled is set to true', () => {
    const service: AdacService = {
      id: 'rds-flag',
      service: 'rds',
      config: { backup_enabled: true },
    } as unknown as AdacService;
    expect(requireBackupRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should check GCP cloud-sql service type', () => {
    const service: AdacService = {
      id: 'cloudsql-no-backup',
      service: 'cloud-sql',
      configuration: { backup_retention_days: 0 },
    } as unknown as AdacService;
    const result = requireBackupRule.evaluate(service, makeContext());
    expect(result?.id).toBe('bck-01');
  });

  it('should return null for GCP cloud-sql with backup_retention_days > 0', () => {
    const service: AdacService = {
      id: 'cloudsql-backed',
      service: 'cloud-sql',
      configuration: { backup_retention_days: 14 },
    } as unknown as AdacService;
    expect(requireBackupRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should check all database service types', () => {
    const dbServices = ['rds', 'dynamodb', 'cloud-sql', 'cloudsql', 'cloud-spanner', 'firestore', 'bigtable'];
    for (const svc of dbServices) {
      const service: AdacService = {
        id: `${svc}-test`,
        service: svc,
        config: { backupRetentionPeriod: 0 },
      } as unknown as AdacService;
      const result = requireBackupRule.evaluate(service, makeContext());
      expect(result?.id).toBe('bck-01');
    }
  });

  it('should include remediation with step referencing the resource id', () => {
    const service: AdacService = {
      id: 'prod-rds',
      service: 'rds',
      config: {},
    } as unknown as AdacService;
    const result = requireBackupRule.evaluate(service, makeContext());
    expect(result?.remediation.id).toBe('rem-bck-01');
    expect(result?.remediation.actionableSteps[0]).toContain('prod-rds');
  });

  it('should use service name in violation message when available', () => {
    const service: AdacService = {
      id: 'my-rds',
      name: 'Primary Database',
      service: 'rds',
      config: {},
    } as unknown as AdacService;
    const result = requireBackupRule.evaluate(service, makeContext());
    expect(result?.message).toContain('Primary Database');
  });
});