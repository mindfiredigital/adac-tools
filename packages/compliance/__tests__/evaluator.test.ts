import { describe, it, expect } from 'vitest';
import { RuleEvaluator } from '../src/evaluator';
import compliantArchBase from './fixtures/compliantArch.json';
import { AdacConfig } from '@mindfiredigital/adac-schema';

describe('RuleEvaluator', () => {
  it('should correctly sum violation stats for compliant architecture', () => {
    const evaluator = new RuleEvaluator();
    // compliantArch has db-1 with compliance: ['pci-dss', 'soc2']
    const byService = evaluator.evaluate(
      compliantArchBase as unknown as AdacConfig
    );

    expect(Object.keys(byService)).toContain('db-1');
    for (const result of byService['db-1']) {
      expect(result.summary.critical).toBe(0);
      expect(result.summary.high).toBe(0);
      expect(result.summary.total).toBe(0);
    }
  });

  it('should produce no results for a service without a compliance field', () => {
    const evaluator = new RuleEvaluator();
    const config: AdacConfig = {
      version: '0.1',
      metadata: { name: 'Test', created: '2026-01-01' },
      infrastructure: {
        clouds: [
          {
            id: 'c1',
            provider: 'aws',
            region: 'us-east-1',
            services: [{ id: 'my-ec2', service: 'ec2' }],
          },
        ],
      },
    };
    const byService = evaluator.evaluate(config);
    expect(Object.keys(byService).length).toBe(0);
  });

  it('should detect IAM wildcard violation', () => {
    const evaluator = new RuleEvaluator();
    const config: AdacConfig = {
      version: '0.1',
      metadata: { name: 'Violation Test', created: '2026-01-01' },
      infrastructure: {
        clouds: [
          {
            id: 'c1',
            provider: 'aws',
            region: 'us-east-1',
            services: [
              {
                id: 'bad-role',
                name: 'Bad Role',
                service: 'iam-role',
                compliance: [
                  'pci-dss',
                ] as AdacConfig['infrastructure']['clouds'][0]['services'][0]['compliance'],
                configuration: {
                  policyDocument: '{"Action":"*"}',
                },
              },
            ],
          },
        ],
      },
    };
    const byService = evaluator.evaluate(config);
    expect(byService['bad-role']).toBeDefined();
    expect(byService['bad-role'][0].summary.high).toBe(1);
    expect(byService['bad-role'][0].violations[0].message).toContain(
      'wildcard actions'
    );
  });

  it('should detect logging violation (log-01)', () => {
    const evaluator = new RuleEvaluator();
    const config: AdacConfig = {
      version: '0.1',
      metadata: { name: 'Log Violation Test', created: '2026-01-01' },
      infrastructure: {
        clouds: [
          {
            id: 'c1',
            provider: 'aws',
            region: 'us-east-1',
            services: [
              {
                id: 's3-1',
                service: 's3',
                compliance: [
                  'pci-dss',
                ] as AdacConfig['infrastructure']['clouds'][0]['services'][0]['compliance'],
              },
            ] as AdacConfig['infrastructure']['clouds'][0]['services'],
          },
        ],
      },
    };
    const byService = evaluator.evaluate(config);
    expect(byService['s3-1'][0].violations.some((v) => v.id === 'log-01')).toBe(
      true
    );
  });

  it('should detect monitoring violation (mon-01)', () => {
    const evaluator = new RuleEvaluator();
    const config: AdacConfig = {
      version: '0.1',
      metadata: { name: 'Mon Violation Test', created: '2026-01-01' },
      infrastructure: {
        clouds: [
          {
            id: 'c1',
            provider: 'aws',
            region: 'us-east-1',
            services: [
              {
                id: 'ec2-1',
                service: 'ec2',
                compliance: [
                  'soc2',
                ] as AdacConfig['infrastructure']['clouds'][0]['services'][0]['compliance'],
              },
            ] as AdacConfig['infrastructure']['clouds'][0]['services'],
          },
        ],
      },
    };
    const byService = evaluator.evaluate(config);
    expect(
      byService['ec2-1'][0].violations.some((v) => v.id === 'mon-01')
    ).toBe(true);
  });
});
