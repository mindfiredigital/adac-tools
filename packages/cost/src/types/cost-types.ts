export type CostPeriod = 'hourly' | 'daily' | 'monthly' | 'yearly';

export type ComputeServiceConfig = EC2Config | ECSConfig | LambdaConfig;
export type DatabaseServiceConfig = RDSConfig | DynamoDBConfig;
export type StorageServiceConfig = S3Config | EBSConfig;
export type NetworkingServiceConfig = ALBConfig | DataTransferConfig;

export interface CostConfig {
  compute?: ComputeServiceConfig[];
  database?: DatabaseServiceConfig[];
  storage?: StorageServiceConfig[];
  networking?: NetworkingServiceConfig[];
  period?: CostPeriod;
}

export interface CostBreakdown {
  compute: number;
  database: number;
  storage: number;
  networking: number;
  total: number;
  period: CostPeriod;
}

export interface AggregatedCost {
  total_monthly: number;
  currency: string;
  period?: CostPeriod;
  by_service?: Record<string, number>;
  by_category?: Record<string, number>;
  by_environment?: Record<string, number>;
  notes?: string[];
}

export interface BaseServiceConfig {
  pricingModel?: PricingModel; // on_demand | reserved
}

export interface EC2Config extends BaseServiceConfig {
  type: 'ec2';
  instanceType: string;
  count: number;
}

export interface ECSConfig extends BaseServiceConfig {
  type: 'ecs';
  vcpu: number;
  memoryGB: number;
  count: number;
}

export interface LambdaConfig extends BaseServiceConfig {
  type: 'lambda';
  requestsPerMonth: number;
  avgDurationMs: number;
  memoryMB: number;
}

export interface RDSConfig extends BaseServiceConfig {
  type: 'rds';
  instanceType: string;
  count: number;
}

export interface DynamoDBConfig extends BaseServiceConfig {
  type: 'dynamodb';
  readUnits: number;
  writeUnits: number;
  storageGB: number;
}

export interface S3Config extends BaseServiceConfig {
  type: 's3';
  tier: 'standard' | 'infrequent_access';
  storageGB: number;
}

export interface EBSConfig extends BaseServiceConfig {
  type: 'ebs';
  volumeType: 'gp3' | 'io1';
  sizeGB: number;
  count: number;
}

export interface ALBConfig extends BaseServiceConfig {
  type: 'alb';
  lcuUnits: number;
}

export interface DataTransferConfig extends BaseServiceConfig {
  type: 'data_transfer';
  transferGB: number;
}

/**
 * Union Type
 */
export type ServiceConfig =
  | EC2Config
  | ECSConfig
  | LambdaConfig
  | RDSConfig
  | DynamoDBConfig
  | S3Config
  | EBSConfig
  | ALBConfig
  | DataTransferConfig;

export type PricingModel = 'on_demand' | 'reserved';

export type TieredPricing = {
  on_demand?: number;
  reserved?: number;
  spot?: number;
};

export type PricingData = {
  currency: string;
  last_updated: string;
  ec2: Record<string, TieredPricing>;
  ecs: Record<string, TieredPricing>;
  rds: Record<string, TieredPricing>;
  s3: Record<'standard' | 'infrequent_access', TieredPricing>;
  ebs: Record<'gp3' | 'io1', TieredPricing>;
  data_transfer: Record<'internet_out', TieredPricing>;
  alb: {
    hourly: TieredPricing;
    lcu: TieredPricing;
  };
  lambda: {
    request: TieredPricing;
    compute: TieredPricing;
  };
  dynamodb: {
    read: TieredPricing;
    write: TieredPricing;
    storage: number;
  };
};
