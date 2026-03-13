import { describe, it, expect } from 'vitest';
import { ComputeCalculator } from '../../src/calculators/compute-calculator';
import { AWSPricing } from '../../src/pricing/aws-pricing';
import type { CostConfig } from '../../src/types';

type ComputeConfig = Pick<CostConfig, 'compute'>;

describe('ComputeCalculator', () => {
  it('should instantiate and return 0', () => {
    const pricing = new AWSPricing();
    const calc = new ComputeCalculator(pricing);
    const emptyConfig: ComputeConfig = { compute: [] };
    expect(calc.calculate(emptyConfig)).toBe(0);
  });

  it('should calculate a positive monthly EC2 cost for single t3.micro', () => {
    const pricing = new AWSPricing();
    const calc = new ComputeCalculator(pricing);

    const singleConfig: ComputeConfig = {
      compute: [
        {
          type: 'ec2',
          instanceType: 't3.micro',
          count: 1,
        },
      ],
    };

    const cost1 = calc.calculate(singleConfig);
    expect(cost1).toBeGreaterThan(0);
  });

  it('should scale linearly with instance count for t3.micro', () => {
    const pricing = new AWSPricing();
    const calc = new ComputeCalculator(pricing);

    const singleConfig: ComputeConfig = {
      compute: [
        {
          type: 'ec2',
          instanceType: 't3.micro',
          count: 1,
        },
      ],
    };

    const tripleConfig: ComputeConfig = {
      compute: [
        {
          type: 'ec2',
          instanceType: 't3.micro',
          count: 3,
        },
      ],
    };

    const cost1 = calc.calculate(singleConfig);
    const cost3 = calc.calculate(tripleConfig);

    expect(cost3).toBeCloseTo(cost1 * 3, 1);
  });

  it('should sum cost across multiple EC2 service entries', () => {
    const pricing = new AWSPricing();
    const calc = new ComputeCalculator(pricing);

    const singleConfig: ComputeConfig = {
      compute: [
        {
          type: 'ec2',
          instanceType: 't3.micro',
          count: 1,
        },
      ],
    };

    const multiEntryConfig: ComputeConfig = {
      compute: [
        {
          type: 'ec2',
          instanceType: 't3.micro',
          count: 1,
        },
        {
          type: 'ec2',
          instanceType: 't3.micro',
          count: 2,
        },
      ],
    };

    const cost1 = calc.calculate(singleConfig);
    const costMulti = calc.calculate(multiEntryConfig);

    // 1 + 2 instances across entries => 3x single-instance cost
    expect(costMulti).toBeCloseTo(cost1 * 3, 1);
  });
});
