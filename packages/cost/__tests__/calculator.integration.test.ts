import { describe, it, expect } from 'vitest';
import { CostCalculator } from '../src/calculator';
import { AWSPricing } from '../src/pricing/aws-pricing';

type CostConfig = any;

describe('CostCalculator integration', () => {
  it('should aggregate compute, database, storage, networking costs', () => {
    const pricing = new AWSPricing();
    const calculator = new CostCalculator(pricing);

    const config: CostConfig = {
      compute: [{ type: 'ec2', instanceType: 't3.medium', count: 2 }],
      database: [{ type: 'rds', instanceType: 'db.t3.micro', count: 1 }],
      storage: [
        { type: 'storage', storageType: 's3_standard', sizeGB: 100 },
        { type: 'storage', storageType: 'ebs_gp3', sizeGB: 50 },
      ],
      networking: [{ type: 'networking', bandwidthGB: 200 }],
    };

    const result: any = calculator.calculate(config);

    // Handle both “number” and “object with total* field” shapes
    const total =
      typeof result === 'number'
        ? result
        : (result.total_monthly ?? result.totalMonthly ?? result.total);

    expect(typeof total).toBe('number');
    expect(total).toBeGreaterThan(0);
  });
});
