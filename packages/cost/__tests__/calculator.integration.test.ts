import { describe, it, expect } from 'vitest';
import { CostCalculator } from '../src/calculator';
import type { CostBreakdown, CostConfig } from '../src/types';

describe('CostCalculator integration', () => {
  it('should aggregate compute, database, storage, networking costs', () => {
    const calculator = new CostCalculator();

    const config: CostConfig = {
      compute: [{ type: 'ec2', instanceType: 't3.medium', count: 2 }],
      database: [{ type: 'rds', instanceType: 'db.t3.micro', count: 1 }],
      storage: [
        { type: 's3', tier: 'standard', storageGB: 100 },
        { type: 'ebs', volumeType: 'gp3', sizeGB: 50, count: 1 },
      ],
      networking: [{ type: 'data_transfer', transferGB: 200 }],
    };

    const result: CostBreakdown = calculator.calculate(config);

    expect(result.total).toBeGreaterThan(0);
  });
});
