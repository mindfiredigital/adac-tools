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
});
