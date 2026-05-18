import { AWSPricing } from '../pricing/aws-pricing';
import type { CostConfig, CostPeriod } from '../types';
import { convertCost, convertMonthlyCost } from '../utils/cost-converter';

export class DatabaseCalculator {
  private pricing: AWSPricing;

  constructor(pricing?: AWSPricing) {
    this.pricing = pricing ?? new AWSPricing();
  }

  calculate(config: CostConfig, period: CostPeriod = 'monthly'): number {
    if (!config?.database) return 0;

    let total = 0;

    for (const service of config.database ?? []) {
      const model = service.pricingModel ?? 'on_demand';

      // =========================
      // RDS
      // =========================
      if (service.type === 'rds') {
        const hourlyPrice = this.pricing.getRDSHourlyPrice(
          service.instanceType,
          model
        );

        const hourlyTotal = hourlyPrice * (service.count ?? 1);

        total += convertCost(hourlyTotal, period);
      }

      // =========================
      // DynamoDB
      // =========================
      if (service.type === 'dynamodb') {
        const readPrice = this.pricing.getDynamoDBReadPrice(model);
        const writePrice = this.pricing.getDynamoDBWritePrice(model);
        const storagePrice = this.pricing.getDynamoDBStoragePrice();

        const monthlyCost =
          (service.readUnits ?? 0) * readPrice +
          (service.writeUnits ?? 0) * writePrice +
          (service.storageGB ?? 0) * storagePrice;

        total += convertMonthlyCost(monthlyCost, period);
      }
    }

    return Number(total.toFixed(2));
  }
}
