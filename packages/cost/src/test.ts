import { CostCalculator } from './calculator';
import type { CostConfig } from './types';

const calculator = new CostCalculator();

const config: CostConfig = {
  period: 'monthly',

  compute: [
    {
      type: 'ec2',
      instanceType: 't3.micro',
      count: 2,
      pricingModel: 'on_demand',
    },
    {
      type: 'lambda',
      requestsPerMonth: 1_000_000,
      avgDurationMs: 100,
      memoryMB: 128,
      pricingModel: 'on_demand',
    },
  ],

  database: [
    {
      type: 'rds',
      instanceType: 'db.t3.micro',
      count: 1,
    },
  ],

  storage: [
    {
      type: 's3',
      tier: 'standard',
      storageGB: 100,
    },
  ],

  networking: [
    {
      type: 'data_transfer',
      transferGB: 50,
    },
  ],
};

const result = calculator.calculate(config);

console.log(result);
