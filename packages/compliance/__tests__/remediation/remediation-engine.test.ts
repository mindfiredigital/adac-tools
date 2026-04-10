import { describe, it, expect } from 'vitest';
import { RemediationEngine } from '../../src/remediation/remediation-engine';
import { ComplianceResult } from '../../src/types';

describe('RemediationEngine', () => {
  it('should return empty array for no results', () => {
    const engine = new RemediationEngine();
    const plan = engine.generateRemediationPlan([]);
    expect(plan).toEqual([]);
  });

  it('should return empty array for compliant results with no violations', () => {
    const engine = new RemediationEngine();
    const results: ComplianceResult[] = [
      {
        framework: 'pci-dss',
        isCompliant: true,
        violations: [],
        summary: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
      },
    ];
    const plan = engine.generateRemediationPlan(results);
    expect(plan).toEqual([]);
  });

  it('should generate a remediation entry for a single violation', () => {
    const engine = new RemediationEngine();
    const results: ComplianceResult[] = [
      {
        framework: 'pci-dss',
        isCompliant: false,
        violations: [
          {
            id: 'enc-01',
            resourceId: 'my-s3',
            framework: 'pci-dss',
            severity: 'high',
            message: 'Encryption not enabled',
            remediation: {
              id: 'rem-enc-01',
              description: 'Enable encryption at rest',
              actionableSteps: ["Set 'encrypted: true'"],
              references: ['https://aws.amazon.com/compliance/'],
            },
          },
        ],
        summary: { critical: 0, high: 1, medium: 0, low: 0, total: 1 },
      },
    ];

    const plan = engine.generateRemediationPlan(results);
    expect(plan.length).toBe(1);
    expect(plan[0].id).toBe('rem-enc-01');
    expect(plan[0].resourceId).toBe('my-s3');
    expect(plan[0].frameworks).toEqual(['pci-dss']);
    expect(plan[0].steps).toEqual(["Set 'encrypted: true'"]);
    expect(plan[0].severity).toBe('high');
  });

  it('should deduplicate violations across multiple frameworks', () => {
    const engine = new RemediationEngine();
    const sameViolation = {
      id: 'enc-01',
      resourceId: 'my-db',
      framework: '',
      severity: 'high' as const,
      message: 'Encryption not enabled',
      remediation: {
        id: 'rem-enc-01',
        description: 'Enable encryption at rest',
        actionableSteps: ["Set 'encrypted: true'"],
        references: [],
      },
    };

    const results: ComplianceResult[] = [
      {
        framework: 'pci-dss',
        isCompliant: false,
        violations: [{ ...sameViolation, framework: 'pci-dss' }],
        summary: { critical: 0, high: 1, medium: 0, low: 0, total: 1 },
      },
      {
        framework: 'hipaa',
        isCompliant: false,
        violations: [{ ...sameViolation, framework: 'hipaa' }],
        summary: { critical: 0, high: 1, medium: 0, low: 0, total: 1 },
      },
    ];

    const plan = engine.generateRemediationPlan(results);
    // Same resource + same rule id should be deduplicated
    expect(plan.length).toBe(1);
    expect(plan[0].frameworks).toContain('pci-dss');
    expect(plan[0].frameworks).toContain('hipaa');
    expect(plan[0].frameworks.length).toBe(2);
  });

  it('should not duplicate the same framework in merged entries', () => {
    const engine = new RemediationEngine();
    const violation = {
      id: 'enc-01',
      resourceId: 'bucket-1',
      framework: 'pci-dss',
      severity: 'high' as const,
      message: 'Encryption not enabled',
      remediation: {
        id: 'rem-enc-01',
        description: 'Enable encryption at rest',
        actionableSteps: ['Enable encryption'],
        references: [],
      },
    };

    // Same framework appearing twice (e.g., two results from same framework)
    const results: ComplianceResult[] = [
      {
        framework: 'pci-dss',
        isCompliant: false,
        violations: [violation],
        summary: { critical: 0, high: 1, medium: 0, low: 0, total: 1 },
      },
      {
        framework: 'pci-dss',
        isCompliant: false,
        violations: [violation],
        summary: { critical: 0, high: 1, medium: 0, low: 0, total: 1 },
      },
    ];

    const plan = engine.generateRemediationPlan(results);
    expect(plan.length).toBe(1);
    // Framework should only appear once despite being processed twice
    expect(plan[0].frameworks.filter((f) => f === 'pci-dss').length).toBe(1);
  });

  it('should produce separate entries for different resources with the same violation', () => {
    const engine = new RemediationEngine();
    const makeViolation = (resourceId: string) => ({
      id: 'enc-01',
      resourceId,
      framework: 'pci-dss',
      severity: 'high' as const,
      message: `Encryption not enabled for ${resourceId}`,
      remediation: {
        id: 'rem-enc-01',
        description: 'Enable encryption at rest',
        actionableSteps: [`Enable encryption for ${resourceId}`],
        references: [],
      },
    });

    const results: ComplianceResult[] = [
      {
        framework: 'pci-dss',
        isCompliant: false,
        violations: [makeViolation('bucket-a'), makeViolation('bucket-b')],
        summary: { critical: 0, high: 2, medium: 0, low: 0, total: 2 },
      },
    ];

    const plan = engine.generateRemediationPlan(results);
    expect(plan.length).toBe(2);
    const resourceIds = plan.map((p) => p.resourceId);
    expect(resourceIds).toContain('bucket-a');
    expect(resourceIds).toContain('bucket-b');
  });

  it('should handle multiple different violations on one resource', () => {
    const engine = new RemediationEngine();
    const results: ComplianceResult[] = [
      {
        framework: 'pci-dss',
        isCompliant: false,
        violations: [
          {
            id: 'enc-01',
            resourceId: 'my-rds',
            framework: 'pci-dss',
            severity: 'high',
            message: 'Encryption not enabled',
            remediation: {
              id: 'rem-enc-01',
              description: 'Enable encryption',
              actionableSteps: ['Enable encryption'],
              references: [],
            },
          },
          {
            id: 'net-01',
            resourceId: 'my-rds',
            framework: 'pci-dss',
            severity: 'critical',
            message: 'DB is publicly accessible',
            remediation: {
              id: 'rem-net-01',
              description: 'Disable public access',
              actionableSteps: ['Set publiclyAccessible: false'],
              references: [],
            },
          },
        ],
        summary: { critical: 1, high: 1, medium: 0, low: 0, total: 2 },
      },
    ];

    const plan = engine.generateRemediationPlan(results);
    expect(plan.length).toBe(2);
    const remIds = plan.map((p) => p.id);
    expect(remIds).toContain('rem-enc-01');
    expect(remIds).toContain('rem-net-01');
  });
});