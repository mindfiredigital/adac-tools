import type { CostConfig, PricingModel } from './types';

export interface AdacCostService {
  id?: string;
  service?: string;
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
    if (typeof config[key] === 'number') return config[key] as number;
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
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return fallback;
}

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
    const s = service.service?.toLowerCase() || '';
    const type = service.type?.toLowerCase() || '';
    const subtype = service.subtype?.toLowerCase() || '';

    if (s === 'ec2' || (type === 'compute' && subtype === 'ec2')) {
      const instanceType = getString(config, [
        'instance_type',
        'instance_class',
        'instanceType',
      ]);
      if (instanceType) {
        costConfig.compute?.push({
          type: 'ec2',
          instanceType,
          count: getNumber(config, ['count'], 1),
          pricingModel,
        });
      }
      continue;
    }

    if (s === 'lambda' || (type === 'compute' && subtype === 'lambda')) {
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

    if (
      s === 'rds' ||
      s.startsWith('rds-') ||
      (type === 'database' && subtype.includes('rds'))
    ) {
      const instanceType = getString(config, [
        'instance_class',
        'instance_type',
        'instanceType',
      ]);
      if (instanceType) {
        costConfig.database?.push({
          type: 'rds',
          instanceType,
          count: getNumber(config, ['count'], 1),
          pricingModel,
        });
      }
      continue;
    }

    if (s === 'dynamodb' || (type === 'database' && subtype === 'dynamodb')) {
      costConfig.database?.push({
        type: 'dynamodb',
        readUnits: getNumber(config, ['read_units', 'readUnits'], 0),
        writeUnits: getNumber(config, ['write_units', 'writeUnits'], 0),
        storageGB: getNumber(config, ['storage_gb', 'storageGB'], 0),
        pricingModel,
      });
      continue;
    }

    if (s === 's3' || (type === 'storage' && subtype === 's3')) {
      const storageGB = getNumber(
        config,
        ['size_gb', 'storage_gb', 'storageGB'],
        Number.NaN
      );
      if (Number.isFinite(storageGB)) {
        const tier = getString(config, ['tier'], 'standard');
        costConfig.storage?.push({
          type: 's3',
          tier: tier === 'infrequent_access' ? 'infrequent_access' : 'standard',
          storageGB,
          pricingModel,
        });
      }
      continue;
    }

    if (type === 'storage' && subtype === 'ebs') {
      const sizeGB = getNumber(config, ['size_gb', 'sizeGB'], Number.NaN);
      if (Number.isFinite(sizeGB)) {
        const volumeType = getString(
          config,
          ['volume_type', 'volumeType'],
          'gp3'
        );
        costConfig.storage?.push({
          type: 'ebs',
          volumeType: volumeType === 'io1' ? 'io1' : 'gp3',
          sizeGB,
          count: getNumber(config, ['count'], 1),
          pricingModel,
        });
      }
      continue;
    }

    if (type === 'network' && subtype === 'application-load-balancer') {
      costConfig.networking?.push({
        type: 'alb',
        lcuUnits: getNumber(config, ['lcu_units', 'lcuUnits'], 1),
        pricingModel,
      });
      continue;
    }

    if (type === 'network' && subtype === 'data-transfer') {
      costConfig.networking?.push({
        type: 'data_transfer',
        transferGB: getNumber(config, ['transfer_gb', 'transferGB'], 50),
        pricingModel,
      });
    }
  }

  return costConfig;
}
