import { describe, it, expect } from 'vitest';
import { OptimizerEngine, analyzeOptimizations } from '../src/index';
import type { AdacConfig } from '@mindfiredigital/adac-schema';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const minimalConfig: AdacConfig = {
  version: '0.1',
  metadata: {
    name: 'test-arch',
    created: '2026-01-01',
  },
  infrastructure: {
    clouds: [
      {
        id: 'aws-prod',
        provider: 'aws',
        region: 'us-east-1',
        services: [],
      },
    ],
  },
};

const makeConfig = (
  services: AdacConfig['infrastructure']['clouds'][0]['services'],
  connections: AdacConfig['connections'] = []
): AdacConfig => ({
  ...minimalConfig,
  infrastructure: {
    clouds: [
      {
        id: 'aws-prod',
        provider: 'aws',
        region: 'us-east-1',
        services,
      },
    ],
  },
  connections,
});

// ─── OptimizerEngine ──────────────────────────────────────────────────────────

describe('OptimizerEngine', () => {
  it('returns a valid result structure for an empty architecture', () => {
    const engine = new OptimizerEngine();
    const result = engine.analyze(minimalConfig);

    expect(result).toHaveProperty('recommendations');
    expect(result).toHaveProperty('byService');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('analyzedAt');
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(result.summary.total).toBe(0);
  });

  it('has correct summary counts', () => {
    const config = makeConfig([
      {
        id: 'rds-1',
        service: 'rds',
        // No encryption, no backup, no AZ → multiple warnings
      },
    ]);
    const engine = new OptimizerEngine();
    const result = engine.analyze(config);

    const sum =
      result.summary.critical +
      result.summary.high +
      result.summary.medium +
      result.summary.low +
      result.summary.info;

    expect(result.summary.total).toBe(result.recommendations.length);
    expect(sum).toBe(result.summary.total);
  });

  it('filters by category', () => {
    const config = makeConfig([
      { id: 'ec2-1', service: 'ec2' },
      { id: 'rds-1', service: 'rds' },
    ]);
    const engine = new OptimizerEngine({ categories: ['cost'] });
    const result = engine.analyze(config);

    for (const rec of result.recommendations) {
      expect(rec.category).toBe('cost');
    }
  });

  it('filters by minimum severity (only critical/high)', () => {
    const config = makeConfig([{ id: 'rds-1', service: 'rds' }]);
    const engine = new OptimizerEngine({ minSeverity: 'high' });
    const result = engine.analyze(config);

    for (const rec of result.recommendations) {
      expect(['critical', 'high']).toContain(rec.severity);
    }
  });

  it('can disable cost rules', () => {
    const config = makeConfig([{ id: 'ec2-1', service: 'ec2', cost: {} }]);
    const engine = new OptimizerEngine({ enableCostRules: false });
    const result = engine.analyze(config);

    const hasCost = result.recommendations.some((r) => r.category === 'cost');
    expect(hasCost).toBe(false);
  });

  it('can disable security rules', () => {
    const config = makeConfig([{ id: 'rds-1', service: 'rds' }]);
    const engine = new OptimizerEngine({ enableSecurityRules: false });
    const result = engine.analyze(config);

    const hasSecurity = result.recommendations.some(
      (r) => r.category === 'security'
    );
    expect(hasSecurity).toBe(false);
  });

  it('can disable reliability rules', () => {
    const config = makeConfig([{ id: 'rds-1', service: 'rds' }]);
    const engine = new OptimizerEngine({ enableReliabilityRules: false });
    const result = engine.analyze(config);

    const hasReliability = result.recommendations.some(
      (r) => r.category === 'reliability'
    );
    expect(hasReliability).toBe(false);
  });

  it('groups recommendations by service correctly', () => {
    const config = makeConfig([
      { id: 'rds-1', service: 'rds' },
      { id: 'ec2-1', service: 'ec2' },
    ]);
    const result = new OptimizerEngine().analyze(config);

    if (result.recommendations.length > 0) {
      // byService keys should be a subset of serviceIds in recommendations
      for (const key of Object.keys(result.byService)) {
        expect(
          result.recommendations.some((r) => r.affectedResources.includes(key))
        ).toBe(true);
      }
    }
  });
});

// ─── Cost rules ───────────────────────────────────────────────────────────────

describe('Cost rules', () => {
  it('flags service with no cost definition', () => {
    const config = makeConfig([{ id: 'ec2-1', service: 'ec2' }]);
    const { recommendations } = new OptimizerEngine({
      categories: ['cost'],
    }).analyze(config);

    const found = recommendations.find(
      (r) => r.id === 'cost-no-definition-ec2-1'
    );
    expect(found).toBeDefined();
  });

  it('does NOT flag service that has a cost block', () => {
    const config = makeConfig([
      {
        id: 'ec2-1',
        service: 'ec2',
        cost: { monthly_usd: 50, billing_model: 'on-demand' },
      },
    ]);
    const { recommendations } = new OptimizerEngine({
      categories: ['cost'],
    }).analyze(config);

    const found = recommendations.find(
      (r) => r.id === 'cost-no-definition-ec2-1'
    );
    expect(found).toBeUndefined();
  });

  it('suggests Reserved Instance for on-demand RDS', () => {
    const config = makeConfig([
      {
        id: 'rds-1',
        service: 'rds',
        cost: { billing_model: 'on-demand' },
      },
    ]);
    const { recommendations } = new OptimizerEngine({
      categories: ['cost'],
    }).analyze(config);

    const found = recommendations.find(
      (r) => r.id === 'cost-ri-opportunity-rds-1'
    );
    expect(found).toBeDefined();
    expect(found?.severity).toBe('medium');
  });

  it('does NOT suggest RI for a service already on reserved billing', () => {
    const config = makeConfig([
      {
        id: 'rds-1',
        service: 'rds',
        cost: { billing_model: 'reserved' },
      },
    ]);
    const { recommendations } = new OptimizerEngine({
      categories: ['cost'],
    }).analyze(config);

    const found = recommendations.find(
      (r) => r.id === 'cost-ri-opportunity-rds-1'
    );
    expect(found).toBeUndefined();
  });
});

// ─── Security rules ───────────────────────────────────────────────────────────

describe('Security rules', () => {
  it('flags RDS without encryption', () => {
    const config = makeConfig([{ id: 'rds-1', service: 'rds' }]);
    const { recommendations } = new OptimizerEngine({
      categories: ['security'],
    }).analyze(config);

    const found = recommendations.find(
      (r) => r.id === 'security-no-encryption-rds-1'
    );
    expect(found).toBeDefined();
    expect(found?.severity).toBe('critical');
  });

  it('does NOT flag RDS with encryption enabled', () => {
    const config = makeConfig([
      { id: 'rds-1', service: 'rds', configuration: { encrypted: true } },
    ]);
    const { recommendations } = new OptimizerEngine({
      categories: ['security'],
    }).analyze(config);

    const found = recommendations.find(
      (r) => r.id === 'security-no-encryption-rds-1'
    );
    expect(found).toBeUndefined();
  });

  it('flags EC2 without IAM role', () => {
    const config = makeConfig([{ id: 'ec2-1', service: 'ec2' }]);
    const { recommendations } = new OptimizerEngine({
      categories: ['security'],
    }).analyze(config);

    const found = recommendations.find(
      (r) => r.id === 'security-no-iam-role-ec2-1'
    );
    expect(found).toBeDefined();
    expect(found?.severity).toBe('high');
  });

  it('does NOT flag EC2 that has an IAM role', () => {
    const config = makeConfig([
      { id: 'ec2-1', service: 'ec2', iam_role: 'arn:aws:iam::123:role/MyRole' },
    ]);
    const { recommendations } = new OptimizerEngine({
      categories: ['security'],
    }).analyze(config);

    const found = recommendations.find(
      (r) => r.id === 'security-no-iam-role-ec2-1'
    );
    expect(found).toBeUndefined();
  });

  it('flags RDS without VPC context as critical', () => {
    const config = makeConfig([{ id: 'rds-1', service: 'rds' }]);
    const { recommendations } = new OptimizerEngine({
      categories: ['security'],
    }).analyze(config);

    const found = recommendations.find((r) => r.id === 'security-no-vpc-rds-1');
    expect(found).toBeDefined();
    expect(found?.severity).toBe('critical');
  });

  it('does NOT flag RDS when subnets are declared', () => {
    const config = makeConfig([
      { id: 'rds-1', service: 'rds', subnets: ['subnet-abc'] },
    ]);
    const { recommendations } = new OptimizerEngine({
      categories: ['security'],
    }).analyze(config);

    const found = recommendations.find((r) => r.id === 'security-no-vpc-rds-1');
    expect(found).toBeUndefined();
  });
});

// ─── Reliability rules ────────────────────────────────────────────────────────

describe('Reliability rules', () => {
  it('flags RDS with a single AZ', () => {
    const config = makeConfig([
      { id: 'rds-1', service: 'rds', availability_zones: ['us-east-1a'] },
    ]);
    const { recommendations } = new OptimizerEngine({
      categories: ['reliability'],
    }).analyze(config);

    const found = recommendations.find(
      (r) => r.id === 'reliability-no-multi-az-rds-1'
    );
    expect(found).toBeDefined();
  });

  it('does NOT flag RDS with multi-AZ', () => {
    const config = makeConfig([
      {
        id: 'rds-1',
        service: 'rds',
        availability_zones: ['us-east-1a', 'us-east-1b'],
      },
    ]);
    const { recommendations } = new OptimizerEngine({
      categories: ['reliability'],
    }).analyze(config);

    const found = recommendations.find(
      (r) => r.id === 'reliability-no-multi-az-rds-1'
    );
    expect(found).toBeUndefined();
  });

  it('flags RDS without backup configuration', () => {
    const config = makeConfig([{ id: 'rds-1', service: 'rds' }]);
    const { recommendations } = new OptimizerEngine({
      categories: ['reliability'],
    }).analyze(config);

    const found = recommendations.find(
      (r) => r.id === 'reliability-no-backup-rds-1'
    );
    expect(found).toBeDefined();
    expect(found?.severity).toBe('high');
  });

  it('does NOT flag RDS with backup_retention_period set', () => {
    const config = makeConfig([
      {
        id: 'rds-1',
        service: 'rds',
        configuration: { backup_retention_period: 14 },
      },
    ]);
    const { recommendations } = new OptimizerEngine({
      categories: ['reliability'],
    }).analyze(config);

    const found = recommendations.find(
      (r) => r.id === 'reliability-no-backup-rds-1'
    );
    expect(found).toBeUndefined();
  });

  it('detects orphaned services', () => {
    const config = makeConfig(
      [
        { id: 'ec2-1', service: 'ec2' },
        { id: 'orphan-1', service: 'lambda' },
      ],
      [{ id: 'c1', from: 'ec2-1', to: 'rds-1', type: 'database-query' }]
    );
    const { recommendations } = new OptimizerEngine({
      categories: ['architecture'],
    }).analyze(config);

    const found = recommendations.find(
      (r) => r.id === 'architecture-orphan-orphan-1'
    );
    expect(found).toBeDefined();
  });
});

// ─── Convenience function ─────────────────────────────────────────────────────

describe('analyzeOptimizations', () => {
  it('returns same result as OptimizerEngine.analyze', () => {
    const config = makeConfig([{ id: 'rds-1', service: 'rds' }]);
    const fromFn = analyzeOptimizations(config);
    const fromEngine = new OptimizerEngine().analyze(config);

    expect(fromFn.summary.total).toBe(fromEngine.summary.total);
    expect(fromFn.recommendations.length).toBe(
      fromEngine.recommendations.length
    );
  });
});
