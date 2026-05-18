import { ComputeCalculator } from './calculators/compute-calculator';
import { DatabaseCalculator } from './calculators/database-calculator';
import { StorageCalculator } from './calculators/storage-calculator';
import { NetworkingCalculator } from './calculators/networking-calculator';

import { CostBreakdown, CostPeriod } from './types/cost-types';
import { CostConfig } from './types';

import { AWSPricing } from './pricing/aws-pricing';

export class CostCalculator {
  private pricing: AWSPricing;

  private compute: ComputeCalculator;
  private database: DatabaseCalculator;
  private storage: StorageCalculator;
  private networking: NetworkingCalculator;

  constructor() {
    this.pricing = new AWSPricing();

    this.compute = new ComputeCalculator(this.pricing);
    this.database = new DatabaseCalculator(this.pricing);
    this.storage = new StorageCalculator(this.pricing);
    this.networking = new NetworkingCalculator(this.pricing);
  }

  calculate(config: CostConfig, period: CostPeriod = 'monthly'): CostBreakdown {
    const computeCost = this.compute.calculate(config, period);
    const databaseCost = this.database.calculate(config, period);
    const storageCost = this.storage.calculate(config, period);
    const networkingCost = this.networking.calculate(config, period);

    const total = computeCost + databaseCost + storageCost + networkingCost;

    return {
      compute: computeCost,
      database: databaseCost,
      storage: storageCost,
      networking: networkingCost,
      total,
      period,
    };
  }
}
