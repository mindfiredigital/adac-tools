import { AWSPricing } from '../pricing/aws-pricing';
import type { CostConfig, CostPeriod } from '../types';
import { convertCost, convertMonthlyCost } from '../utils/cost-converter';

export class NetworkingCalculator {
  private pricing: AWSPricing;

  constructor(pricing?: AWSPricing) {
    this.pricing = pricing ?? new AWSPricing();
  }

  calculate(config: CostConfig, period: CostPeriod = 'monthly'): number {
    if (!config?.networking) return 0;

    let total = 0;

    for (const service of config.networking ?? []) {
      const model = service.pricingModel ?? 'on_demand';

      // =========================
      // Data Transfer
      // =========================
      if (service.type === 'data_transfer') {
        const pricePerGB = this.pricing.getDataTransferPrice(
          'internet_out',
          model
        );

        const monthlyCost = pricePerGB * (service.transferGB ?? 0);

        total += convertMonthlyCost(monthlyCost, period);
      }

      // =========================
      // Application Load Balancer
      // =========================
      if (service.type === 'alb') {
        const hourlyPrice = this.pricing.getALBHourlyPrice(model);
        const lcuPrice = this.pricing.getALBLCUPrice(model);

        const hourlyCost = convertCost(hourlyPrice, period);
        const lcuMonthlyCost = lcuPrice * (service.lcuUnits ?? 0);

        total += hourlyCost + convertMonthlyCost(lcuMonthlyCost, period);
      }
    }

    return Number(total.toFixed(2));
  }
}
