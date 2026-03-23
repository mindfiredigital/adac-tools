import fs from 'fs';
import yaml from 'js-yaml';
import { CostCalculator } from './calculator';
import {
  mapAdacServicesToCostConfig,
  type AdacCostService,
} from './adac-to-cost-config';
import type { CostPeriod, PricingModel } from './types/cost-types';

interface YamlCloud {
  services?: AdacCostService[];
}

interface YamlInfrastructure {
  infrastructure?: {
    clouds?: YamlCloud[];
  };
}

export function aggregateCostFromYaml(
  yamlPath: string,
  period: CostPeriod = 'monthly',
  pricingModel: PricingModel = 'on_demand'
) {
  const file = fs.readFileSync(yamlPath, 'utf8');
  const parsed = yaml.load(file) as YamlInfrastructure;
  const services =
    parsed.infrastructure?.clouds?.flatMap((cloud) => cloud.services ?? []) ?? [];
  const costConfig = mapAdacServicesToCostConfig(services, pricingModel);

  return new CostCalculator().calculate(costConfig, period);
}
