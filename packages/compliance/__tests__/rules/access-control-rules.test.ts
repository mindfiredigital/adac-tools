import { describe, it, expect } from 'vitest';
import { requireLeastPrivilegeRule } from '../../src/rules/access-control-rules';
import { AdacConfig } from '@mindfiredigital/adac-schema';

type AdacService = AdacConfig['infrastructure']['clouds'][0]['services'][0];

const makeContext = (): { config: AdacConfig } => ({
  config: {
    version: '0.1',
    metadata: { name: 'Test', created: '2026-01-01' },
    infrastructure: { clouds: [] },
  },
});

describe('requireLeastPrivilegeRule (iam-01)', () => {
  it('should be registered with correct metadata', () => {
    expect(requireLeastPrivilegeRule.id).toBe('iam-01');
    expect(requireLeastPrivilegeRule.frameworks).toContain('pci-dss');
    expect(requireLeastPrivilegeRule.frameworks).toContain('soc2');
    expect(requireLeastPrivilegeRule.frameworks).toContain('hipaa');
    expect(requireLeastPrivilegeRule.frameworks).toContain('iso27001');
    expect(requireLeastPrivilegeRule.frameworks).toContain('fedramp');
    expect(requireLeastPrivilegeRule.severity).toBe('high');
  });

  it('should return null for non-IAM services', () => {
    const service: AdacService = { id: 'ec2-1', service: 'ec2' };
    expect(requireLeastPrivilegeRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should return a violation for iam-role with wildcard action using compact notation', () => {
    const service: AdacService = {
      id: 'bad-role',
      service: 'iam-role',
      configuration: { policyDocument: '{"Action":"*"}' },
    } as unknown as AdacService;
    const result = requireLeastPrivilegeRule.evaluate(service, makeContext());
    expect(result).not.toBeNull();
    expect(result?.id).toBe('iam-01');
    expect(result?.resourceId).toBe('bad-role');
    expect(result?.severity).toBe('high');
  });

  it('should return a violation for iam-role with wildcard action using spaced notation', () => {
    const service: AdacService = {
      id: 'bad-role-spaced',
      service: 'iam-role',
      configuration: { policyDocument: '{"Action": "*"}' },
    } as unknown as AdacService;
    const result = requireLeastPrivilegeRule.evaluate(service, makeContext());
    expect(result).not.toBeNull();
    expect(result?.id).toBe('iam-01');
  });

  it('should return null for iam-role with restricted actions', () => {
    const service: AdacService = {
      id: 'good-role',
      service: 'iam-role',
      configuration: { policyDocument: '{"Action":"s3:GetObject"}' },
    } as unknown as AdacService;
    expect(requireLeastPrivilegeRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should check iam-policy service type', () => {
    const service: AdacService = {
      id: 'admin-policy',
      service: 'iam-policy',
      configuration: { policyDocument: '{"Action":"*"}' },
    } as unknown as AdacService;
    const result = requireLeastPrivilegeRule.evaluate(service, makeContext());
    expect(result?.id).toBe('iam-01');
  });

  it('should check cloud-iam service type (GCP)', () => {
    const service: AdacService = {
      id: 'gcp-iam',
      service: 'cloud-iam',
      config: { policyDocument: '{"Action":"*"}' },
    } as unknown as AdacService;
    const result = requireLeastPrivilegeRule.evaluate(service, makeContext());
    expect(result?.id).toBe('iam-01');
  });

  it('should check service-account service type (GCP)', () => {
    const service: AdacService = {
      id: 'gcp-sa',
      service: 'service-account',
      config: { policy: '{"Action":"*"}' },
    } as unknown as AdacService;
    const result = requireLeastPrivilegeRule.evaluate(service, makeContext());
    expect(result?.id).toBe('iam-01');
  });

  it('should return null when no policyDocument or policy is set', () => {
    const service: AdacService = {
      id: 'role-no-policy',
      service: 'iam-role',
      configuration: {},
    } as unknown as AdacService;
    expect(requireLeastPrivilegeRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should return null when policyDocument is not a string', () => {
    const service: AdacService = {
      id: 'role-obj-policy',
      service: 'iam-role',
      configuration: { policyDocument: { Action: '*' } },
    } as unknown as AdacService;
    expect(requireLeastPrivilegeRule.evaluate(service, makeContext())).toBeNull();
  });

  it('should include remediation steps referencing the resource id', () => {
    const service: AdacService = {
      id: 'bad-role',
      service: 'iam-role',
      configuration: { policyDocument: '{"Action":"*"}' },
    } as unknown as AdacService;
    const result = requireLeastPrivilegeRule.evaluate(service, makeContext());
    expect(result?.remediation.id).toBe('rem-iam-01');
    expect(result?.remediation.actionableSteps[0]).toContain('bad-role');
  });

  it('should use service name in violation message when available', () => {
    const service: AdacService = {
      id: 'admin-role',
      name: 'Admin Role',
      service: 'iam-role',
      configuration: { policyDocument: '{"Action":"*"}' },
    } as unknown as AdacService;
    const result = requireLeastPrivilegeRule.evaluate(service, makeContext());
    expect(result?.message).toContain('Admin Role');
  });
});