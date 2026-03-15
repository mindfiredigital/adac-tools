import { describe, it, expect } from 'vitest';
import { CostCalculator } from '../src/calculator';

type CostConfig = any;

describe('CostCalculator EC2 + RDS', () => {
  it('should aggregate EC2 and RDS costs into a positive total', () => {
    const calc = new CostCalculator();

    const config: CostConfig = {
      compute: [{ type: 'ec2', instanceType: 't3.medium', count: 2 }],
      database: [{ type: 'rds', instanceType: 'db.t3.micro', count: 1 }],
    };

    const result: any = calc.calculate(config);

    const total =
      typeof result === 'number'
        ? result
        : (result.total_monthly ?? result.totalMonthly ?? result.total);

    expect(typeof total).toBe('number');
    expect(total).toBeGreaterThan(0);
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

    const resEc2: any = calc.calculate(ec2Only);
    const resBoth: any = calc.calculate(ec2PlusRds);

    const totalEc2 =
      typeof resEc2 === 'number'
        ? resEc2
        : (resEc2.total_monthly ?? resEc2.totalMonthly ?? resEc2.total);

    const totalBoth =
      typeof resBoth === 'number'
        ? resBoth
        : (resBoth.total_monthly ?? resBoth.totalMonthly ?? resBoth.total);

    expect(totalBoth).toBeGreaterThan(totalEc2);
  });
});

describe('CostCalculator', () => {
  it('should instantiate without error', () => {
    const calc = new CostCalculator();
    expect(calc).toBeDefined();
  });
});
