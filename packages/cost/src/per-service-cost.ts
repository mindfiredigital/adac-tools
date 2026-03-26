import { CostCalculator } from './calculator';
import {
  mapAdacServicesToCostConfig,
  type AdacCostService,
} from './adac-to-cost-config';
import type { CostPeriod, PricingModel } from './types';

interface AdacCostConfigInput {
  infrastructure?: {
    clouds?: Array<{
      services?: AdacCostService[];
    }>;
  };
}

/**
 * Calculates per-service costs from a parsed ADAC config.
 * Returns a mapping of serviceId to cost for the given period.
 */
export function calculatePerServiceCosts(
  adac: AdacCostConfigInput,
  period: CostPeriod = 'monthly',
  pricingModel: PricingModel = 'on_demand'
): Record<string, number> | undefined {
  const services = (adac.infrastructure?.clouds?.flatMap(
    (cloud) => cloud.services ?? []
  ) ?? []) as AdacCostService[];
  if (services.length === 0) {
    return undefined;
  }

  const calculator = new CostCalculator();
  const perService: Record<string, number> = {};

  for (const service of services) {
    if (!service.id) {
      continue;
    }

    const costConfig = mapAdacServicesToCostConfig([service], pricingModel);
    const result = calculator.calculate(costConfig, period);

    if (result.total > 0) {
      perService[service.id] = result.total;
    }
  }

  return Object.keys(perService).length > 0 ? perService : undefined;
}
