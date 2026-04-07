import type { CostConfig, PricingModel } from './types';

export interface AdacCostService {
  id?: string;
  type?: string;
  subtype?: string;
  config?: Record<string, unknown>;
  configuration?: Record<string, unknown>;
}

function getServiceConfig(service: AdacCostService): Record<string, unknown> {
  return {
    ...(service.configuration ?? {}),
    ...(service.config ?? {}),
  };
}

function getNumber(
  config: Record<string, unknown>,
  keys: string[],
  fallback: number
): number {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === 'number') {
      return value;
    }
  }

  return fallback;
}

function getString(
  config: Record<string, unknown>,
  keys: string[],
  fallback?: string
): string | undefined {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return fallback;
}

/**
 * Maps ADAC service definitions to a cost configuration structure for calculation.
 * @param services - Array of ADAC service definitions from the parsed YAML
 * @param pricingModel - Pricing model to apply ('on_demand' or 'reserved')
 * @returns CostConfig object with services categorized by compute, database, storage, and networking
 */
export function mapAdacServicesToCostConfig(
  services: AdacCostService[],
  pricingModel: PricingModel = 'on_demand'
): CostConfig {
  const costConfig: CostConfig = {
    compute: [],
    database: [],
    storage: [],
    networking: [],
  };

  for (const service of services) {
    const config = getServiceConfig(service);

    if (service.type === 'compute' && service.subtype === 'ec2') {
      const instanceType = getString(config, [
        'instance_class',
        'instanceType',
      ]);
      if (!instanceType) {
        continue;
      }

      costConfig.compute?.push({
        type: 'ec2',
        instanceType,
        count: getNumber(config, ['count'], 1),
        pricingModel,
      });
      continue;
    }

    if (service.type === 'compute' && service.subtype === 'ecs-fargate') {
      costConfig.compute?.push({
        type: 'ecs',
        vcpu: getNumber(config, ['vcpu', 'cpu'], 0.25),
        memoryGB: getNumber(config, ['memory_gb', 'memoryGB', 'memory'], 0.5),
        count: getNumber(config, ['count'], 1),
        pricingModel,
      });
      continue;
    }

    if (service.type === 'compute' && service.subtype === 'lambda') {
      costConfig.compute?.push({
        type: 'lambda',
        requestsPerMonth: getNumber(
          config,
          ['requests_per_month', 'requestsPerMonth'],
          1_000_000
        ),
        avgDurationMs: getNumber(
          config,
          ['avg_duration_ms', 'avgDurationMs'],
          100
        ),
        memoryMB: getNumber(config, ['memory_mb', 'memoryMB'], 128),
        pricingModel,
      });
      continue;
    }

    if (service.type === 'database' && service.subtype === 'rds-postgres') {
      const instanceType = getString(config, [
        'instance_class',
        'instanceType',
      ]);
      if (!instanceType) {
        continue;
      }

      costConfig.database?.push({
        type: 'rds',
        instanceType,
        count: getNumber(config, ['count'], 1),
        pricingModel,
      });
      continue;
    }

    if (service.type === 'database' && service.subtype === 'dynamodb') {
      costConfig.database?.push({
        type: 'dynamodb',
        readUnits: getNumber(config, ['read_units', 'readUnits'], 0),
        writeUnits: getNumber(config, ['write_units', 'writeUnits'], 0),
        storageGB: getNumber(config, ['storage_gb', 'storageGB'], 0),
        pricingModel,
      });
      continue;
    }

    if (service.type === 'storage' && service.subtype === 's3') {
      const tier = getString(config, ['tier'], 'standard');
      const storageGB = getNumber(
        config,
        ['size_gb', 'storage_gb', 'storageGB'],
        Number.NaN
      );
      if (!Number.isFinite(storageGB)) {
        continue;
      }

      costConfig.storage?.push({
        type: 's3',
        tier: tier === 'infrequent_access' ? 'infrequent_access' : 'standard',
        storageGB,
        pricingModel,
      });
      continue;
    }

    if (service.type === 'storage' && service.subtype === 'ebs') {
      const volumeType = getString(
        config,
        ['volume_type', 'volumeType'],
        'gp3'
      );
      const sizeGB = getNumber(config, ['size_gb', 'sizeGB'], Number.NaN);
      if (!Number.isFinite(sizeGB)) {
        continue;
      }

      costConfig.storage?.push({
        type: 'ebs',
        volumeType: volumeType === 'io1' ? 'io1' : 'gp3',
        sizeGB,
        count: getNumber(config, ['count'], 1),
        pricingModel,
      });
      continue;
    }

    if (
      service.type === 'network' &&
      service.subtype === 'application-load-balancer'
    ) {
      costConfig.networking?.push({
        type: 'alb',
        lcuUnits: getNumber(config, ['lcu_units', 'lcuUnits'], 1),
        pricingModel,
      });
      continue;
    }

    if (service.type === 'network' && service.subtype === 'data-transfer') {
      costConfig.networking?.push({
        type: 'data_transfer',
        transferGB: getNumber(config, ['transfer_gb', 'transferGB'], 50),
        pricingModel,
      });
    }
  }

  return costConfig;
}
