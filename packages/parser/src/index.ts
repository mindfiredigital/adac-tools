import fs from 'fs';
import yaml from 'js-yaml';
import {
  AdacConfig,
  validateAdacConfig,
  ValidationResult,
} from '@mindfiredigital/adac-schema';
import { CostCalculator } from '@mindfiredigital/adac-cost';
import type { CostConfig } from '@mindfiredigital/adac-cost';
export interface CostBreakdown {
  compute: number;
  database: number;
  storage: number;
  networking: number;
  total: number;
  period: 'hourly' | 'daily' | 'monthly' | 'yearly';
  perService?: Record<string, number>;
}

export interface AdacConfigWithCosts extends AdacConfig {
  costs?: CostBreakdown;
}

export class AdacParseError extends Error {
  constructor(
    message: string,
    public errors?: string[]
  ) {
    super(message);
    this.name = 'AdacParseError';
  }
}

export interface ParseOptions {
  validate?: boolean;
  includeCost?: boolean;
  costPeriod?: 'hourly' | 'daily' | 'monthly' | 'yearly';
  pricingModel?: 'on_demand' | 'reserved';
}

function extractCostConfig(
  config: AdacConfig,
  pricingModel: 'on_demand' | 'reserved' = 'on_demand'
): CostConfig {
  const costConfig: CostConfig = {
    compute: [],
    database: [],
    storage: [],
    networking: [],
  };

  const services = config.infrastructure?.clouds?.[0]?.services ?? [];

  for (const svc of services) {
    if (svc.type === 'compute' && costConfig.compute) {
      costConfig.compute.push({
        type: 'ec2',
        instanceType: (svc.config?.instance_class as string) ?? 't3.micro',
        count: (svc.config?.count as number) ?? 1,
        pricingModel,
      });
    } else if (svc.type === 'database' && costConfig.database) {
      costConfig.database.push({
        type: 'rds',
        instanceType: (svc.config?.instance_class as string) ?? 'db.t3.micro',
        count: (svc.config?.count as number) ?? 1,
        pricingModel,
      });
    } else if (svc.type === 'storage' && costConfig.storage) {
      costConfig.storage.push({
        type: 's3',
        tier: 'standard',
        storageGB: (svc.config?.size_gb as number) ?? 100,
        pricingModel,
      });
    } else if (svc.type === 'network' && costConfig.networking) {
      costConfig.networking.push({
        type: 'data_transfer',
        transferGB: (svc.config?.transfer_gb as number) ?? 50, // ✅ ADD
        pricingModel,
      });
    }
  }
  return costConfig;
}

export function parseAdacFromContent(
  content: string,
  options: ParseOptions = { validate: true, includeCost: true }
): AdacConfigWithCosts {
  let parsed: unknown;

  try {
    parsed = yaml.load(content);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AdacParseError(`Failed to parse YAML content: ${msg}`);
  }

  if (options.validate) {
    const validation: ValidationResult = validateAdacConfig(parsed);

    if (!validation.valid) {
      throw new AdacParseError('Schema validation failed', validation.errors);
    }
  }

  const config = parsed as AdacConfig;

  if (options.includeCost) {
    const costConfig = extractCostConfig(config, options.pricingModel);
    const calculator = new CostCalculator();
    const period = (options.costPeriod ?? 'monthly') as
      | 'hourly'
      | 'daily'
      | 'monthly'
      | 'yearly';
    const costBreakdown = calculator.calculate(costConfig, period);

    const perService: Record<string, number> = {};
    const services = config.infrastructure?.clouds?.[0]?.services ?? [];

    services.forEach((svc) => {
      if (svc.subtype === 'subnet' || svc.subtype === 'vpc') {
        return;
      }
      if (svc.type === 'compute') {
        const computeCount = services.filter(
          (s) => s.type === 'compute'
        ).length;
        perService[svc.id] = costBreakdown.compute / computeCount;
      } else if (svc.type === 'database') {
        const dbCount = services.filter((s) => s.type === 'database').length;
        perService[svc.id] = costBreakdown.database / dbCount;
      } else if (svc.type === 'storage') {
        const storageCount = services.filter(
          (s) => s.type === 'storage'
        ).length;
        perService[svc.id] = costBreakdown.storage / storageCount;
      } else if (svc.type === 'network' && svc.subtype !== 'subnet') {
        const networkCount = services.filter(
          (s) => s.type === 'network' && s.subtype !== 'subnet'
        ).length;
        perService[svc.id] = costBreakdown.networking / networkCount;
      }
    });

    return {
      ...config,
      costs: {
        compute: costBreakdown.compute,
        database: costBreakdown.database,
        storage: costBreakdown.storage,
        networking: costBreakdown.networking,
        total: costBreakdown.total,
        period: costBreakdown.period,
        perService,
      },
    };
  }

  return config;
}

export function parseAdac(
  filePath: string,
  options: ParseOptions = { validate: true }
): AdacConfigWithCosts {
  if (!fs.existsSync(filePath)) {
    throw new AdacParseError(`File not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');

  return parseAdacFromContent(raw, options);
}
