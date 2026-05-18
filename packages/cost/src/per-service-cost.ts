import { CostCalculator } from './calculator';
import {
  mapAdacServicesToCostConfig,
  type AdacCostService,
} from './adac-to-cost-config';
import type { CostPeriod, PricingModel } from './types';

interface AdacCostConfigInput {
  infrastructure?: {
    clouds?: Array<{ services?: AdacCostService[] }>;
  };
}

export function calculatePerServiceCosts(
  adac: AdacCostConfigInput,
  period: CostPeriod = 'monthly',
  pricingModel: PricingModel = 'on_demand'
): Record<string, number> | undefined {
  const services =
    adac.infrastructure?.clouds?.flatMap((c) => c.services ?? []) ?? [];
  if (!services.length) return undefined;

  const calculator = new CostCalculator();
  const perService: Record<string, number> = {};

  for (const s of services) {
    if (!s.id) continue;
    const result = calculator.calculate(
      mapAdacServicesToCostConfig([s], pricingModel),
      period
    );
    if (result.total > 0) perService[s.id] = result.total;
  }

  return Object.keys(perService).length ? perService : undefined;
}
