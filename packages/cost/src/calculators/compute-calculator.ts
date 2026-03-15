// Compute cost calculator

import { AWSPricing } from '../pricing/aws-pricing';
import type { CostConfig, CostPeriod } from '../types';
import { convertCost, convertMonthlyCost } from '../utils/cost-converter';

export class ComputeCalculator {
  private pricing: AWSPricing;

  constructor(pricing: AWSPricing) {
    this.pricing = pricing;
  }

  calculate(config: CostConfig, period: CostPeriod = 'monthly'): number {
    if (!config?.compute) return 0;

    let total = 0;

    for (const service of config.compute) {
      const model = service.pricingModel ?? 'on_demand';

      // =========================
      // EC2
      // =========================
      if (service.type === 'ec2') {
        const hourlyPrice = this.pricing.getEC2HourlyPrice(
          service.instanceType,
          model
        );

        const hourlyTotal = hourlyPrice * (service.count ?? 1);

        total += convertCost(hourlyTotal, period);
      }

      // =========================
      // ECS
      // =========================
      if (service.type === 'ecs') {
        const hourlyPrice = this.pricing.getECSHourlyPrice(
          service.instanceType,
          model
        );

        const hourlyTotal = hourlyPrice * (service.count ?? 1);

        total += convertCost(hourlyTotal, period);
      }

      // =========================
      // Lambda
      // =========================
      if (service.type === 'lambda') {
        const requests = service.requestsPerMonth ?? 0;

        const requestPricePerMillion =
          this.pricing.getLambdaRequestPrice(model);

        const computePricePerGBSecond =
          this.pricing.getLambdaComputePrice(model);

        // Request cost
        const requestCostMonthly =
          (requests / 1_000_000) * requestPricePerMillion;

        // Compute cost
        const durationSeconds = (service.avgDurationMs ?? 0) / 1000;
        const memoryGB = (service.memoryMB ?? 0) / 1024;

        const gbSeconds = requests * durationSeconds * memoryGB;

        const computeCostMonthly = gbSeconds * computePricePerGBSecond;

        const lambdaMonthlyCost = requestCostMonthly + computeCostMonthly;

        total += convertMonthlyCost(lambdaMonthlyCost, period);
      }
    }

    return Number(total.toFixed(2));
  }
}
