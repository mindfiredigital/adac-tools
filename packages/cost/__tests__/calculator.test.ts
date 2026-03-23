import { describe, it, expect } from 'vitest';
import { CostCalculator } from '../src/calculator';
import type { CostBreakdown, CostConfig } from '../src/types';

describe('CostCalculator EC2 + RDS', () => {
  it('should aggregate EC2 and RDS costs into a positive total', () => {
    const calc = new CostCalculator();

    const config: CostConfig = {
      compute: [{ type: 'ec2', instanceType: 't3.medium', count: 2 }],
      database: [{ type: 'rds', instanceType: 'db.t3.micro', count: 1 }],
    };

    const result: CostBreakdown = calc.calculate(config);

    expect(result.total).toBeGreaterThan(0);
  });

  it('should charge more when RDS is added on top of EC2', () => {
    const calc = new CostCalculator();

    const ec2Only: CostConfig = {
      compute: [{ type: 'ec2', instanceType: 't3.medium', count: 2 }],
    };

    const ec2PlusRds: CostConfig = {
      compute: [{ type: 'ec2', instanceType: 't3.medium', count: 2 }],
      database: [{ type: 'rds', instanceType: 'db.t3.micro', count: 1 }],
    };

    const resEc2: CostBreakdown = calc.calculate(ec2Only);
    const resBoth: CostBreakdown = calc.calculate(ec2PlusRds);

    expect(resBoth.total).toBeGreaterThan(resEc2.total);
  });
});

describe('CostCalculator', () => {
  it('should instantiate without error', () => {
    const calc = new CostCalculator();
    expect(calc).toBeDefined();
  });
});
