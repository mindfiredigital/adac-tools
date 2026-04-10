import { describe, it, expect } from 'vitest';
import { requireStorageEncryptionRule } from '../../src/rules/encryption-rules';
import { AdacConfig } from '@mindfiredigital/adac-schema';

type AdacService = AdacConfig['infrastructure']['clouds'][0]['services'][0];

const makeContext = (): { config: AdacConfig } => ({
  config: {
    version: '0.1',
    metadata: { name: 'Test', created: '2026-01-01' },
    infrastructure: { clouds: [] },
  },
});

describe('requireStorageEncryptionRule (enc-01)', () => {
  it('should be registered with correct metadata', () => {
    expect(requireStorageEncryptionRule.id).toBe('enc-01');
    expect(requireStorageEncryptionRule.frameworks).toContain('pci-dss');
    expect(requireStorageEncryptionRule.frameworks).toContain('hipaa');
    expect(requireStorageEncryptionRule.frameworks).toContain('gdpr');
    expect(requireStorageEncryptionRule.frameworks).toContain('soc2');
    expect(requireStorageEncryptionRule.severity).toBe('high');
  });

  it('should return null for non-storage services', () => {
    const service: AdacService = { id: 'ec2-1', service: 'ec2' };
    expect(requireStorageEncryptionRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should return a violation for unencrypted s3 bucket', () => {
    const service: AdacService = {
      id: 'bucket-1',
      service: 's3',
      config: { encrypted: false },
    } as unknown as AdacService;
    const result = requireStorageEncryptionRule.evaluate(service, makeContext());
    expect(result).not.toBeNull();
    expect(result?.id).toBe('enc-01');
    expect(result?.resourceId).toBe('bucket-1');
    expect(result?.severity).toBe('high');
  });

  it('should return null for s3 with encrypted: true', () => {
    const service: AdacService = {
      id: 'bucket-enc',
      service: 's3',
      config: { encrypted: true },
    } as unknown as AdacService;
    expect(requireStorageEncryptionRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should return null for s3 with sseAlgorithm set', () => {
    const service: AdacService = {
      id: 'bucket-sse',
      service: 's3',
      config: { sseAlgorithm: 'AES256' },
    } as unknown as AdacService;
    expect(requireStorageEncryptionRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should return null for rds with storageEncrypted: true', () => {
    const service: AdacService = {
      id: 'rds-1',
      service: 'rds',
      config: { storageEncrypted: true },
    } as unknown as AdacService;
    expect(requireStorageEncryptionRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should return null for service using encryption_enabled flag', () => {
    const service: AdacService = {
      id: 'gcs-1',
      service: 'gcs',
      configuration: { encryption_enabled: true },
    } as unknown as AdacService;
    expect(requireStorageEncryptionRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should handle GCP services (cloud-sql, bigquery, firestore, bigtable)', () => {
    const gcpServices = ['cloud-sql', 'bigquery', 'firestore', 'bigtable', 'cloud-spanner', 'cloudsql'];
    for (const svc of gcpServices) {
      const service: AdacService = {
        id: `${svc}-1`,
        service: svc,
      } as unknown as AdacService;
      const result = requireStorageEncryptionRule.evaluate(service, makeContext());
      expect(result?.id).toBe('enc-01');
    }
  });

  it('should include remediation steps', () => {
    const service: AdacService = {
      id: 'rds-unsafe',
      service: 'rds',
      config: {},
    } as unknown as AdacService;
    const result = requireStorageEncryptionRule.evaluate(service, makeContext());
    expect(result?.remediation.id).toBe('rem-enc-01');
    expect(result?.remediation.actionableSteps.length).toBeGreaterThan(0);
    expect(result?.remediation.references.length).toBeGreaterThan(0);
  });

  it('should use service name in violation message when available', () => {
    const service: AdacService = {
      id: 'my-bucket',
      name: 'Production Bucket',
      service: 's3',
      config: {},
    } as unknown as AdacService;
    const result = requireStorageEncryptionRule.evaluate(service, makeContext());
    expect(result?.message).toContain('Production Bucket');
  });
});