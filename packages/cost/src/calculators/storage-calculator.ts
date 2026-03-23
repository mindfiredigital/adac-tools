import { AWSPricing } from '../pricing/aws-pricing';
import type { CostConfig, CostPeriod } from '../types';
import { convertMonthlyCost } from '../utils/cost-converter';

export class StorageCalculator {
  private pricing: AWSPricing;

  constructor(pricing?: AWSPricing) {
    this.pricing = pricing ?? new AWSPricing();
  }

  calculate(config: CostConfig, period: CostPeriod = 'monthly'): number {
    if (!config?.storage) return 0;

    let total = 0;

    for (const service of config.storage ?? []) {
      const model = service.pricingModel ?? 'on_demand';

      // =========================
      // S3
      // =========================
      if (service.type === 's3') {
        const pricePerGB = this.pricing.getS3Price(service.tier, model);

        const monthlyCost = pricePerGB * (service.storageGB ?? 0);

        total += convertMonthlyCost(monthlyCost, period);
      }

      // =========================
      // EBS
      // =========================
      if (service.type === 'ebs') {
        const pricePerGB = this.pricing.getEBSPrice(service.volumeType, model);

        const monthlyCost =
          pricePerGB * (service.sizeGB ?? 0) * (service.count ?? 1);

        total += convertMonthlyCost(monthlyCost, period);
      }
    }

    return Number(total.toFixed(2));
  }
}
