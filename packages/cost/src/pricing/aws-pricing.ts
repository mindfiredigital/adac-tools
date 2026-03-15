import pricingData from './pricing-data.json';
import type { PricingData, PricingModel, TieredPricing } from '../types';

export type { PricingModel };

const data = pricingData as PricingData;

export class AWSPricing {
  private getTieredPrice(
    record: TieredPricing | undefined,
    pricingModel?: PricingModel
  ): number {
    if (!record) return 0;
    const model = pricingModel ?? 'on_demand';
    return record[model] ?? 0;
  }

  // =========================
  // COMPUTE
  // =========================

  getEC2HourlyPrice(instanceType: string, pricingModel?: PricingModel): number {
    return this.getTieredPrice(data.ec2[instanceType], pricingModel);
  }

  getECSHourlyPrice(instanceType: string, pricingModel?: PricingModel): number {
    const record = data.ecs[instanceType];
    if (typeof record === 'number') return record;
    return this.getTieredPrice(record, pricingModel);
  }

  getLambdaRequestPrice(pricingModel?: PricingModel): number {
    return this.getTieredPrice(data.lambda.request, pricingModel);
  }

  getLambdaComputePrice(pricingModel?: PricingModel): number {
    return this.getTieredPrice(data.lambda.compute, pricingModel);
  }

  // =========================
  // DATABASE
  // =========================

  getRDSHourlyPrice(instanceType: string, pricingModel?: PricingModel): number {
    return this.getTieredPrice(data.rds[instanceType], pricingModel);
  }

  getDynamoDBReadPrice(pricingModel?: PricingModel): number {
    return this.getTieredPrice(data.dynamodb.read, pricingModel);
  }

  getDynamoDBWritePrice(pricingModel?: PricingModel): number {
    return this.getTieredPrice(data.dynamodb.write, pricingModel);
  }

  getDynamoDBStoragePrice(): number {
    return data.dynamodb.storage ?? 0;
  }

  // =========================
  // STORAGE
  // =========================

  getS3Price(
    tier: 'standard' | 'infrequent_access',
    pricingModel?: PricingModel
  ): number {
    return this.getTieredPrice(data.s3[tier], pricingModel);
  }

  getEBSPrice(type: 'gp3' | 'io1', pricingModel?: PricingModel): number {
    return this.getTieredPrice(data.ebs[type], pricingModel);
  }

  // =========================
  // NETWORKING
  // =========================

  getDataTransferPrice(
    type: 'internet_out',
    pricingModel?: PricingModel
  ): number {
    return this.getTieredPrice(data.data_transfer[type], pricingModel);
  }

  getALBHourlyPrice(pricingModel?: PricingModel): number {
    return this.getTieredPrice(data.alb.hourly, pricingModel);
  }

  getALBLCUPrice(pricingModel?: PricingModel): number {
    return this.getTieredPrice(data.alb.lcu, pricingModel);
  }

  // =========================
  // METADATA
  // =========================

  getLastUpdated(): string {
    return data.last_updated;
  }

  getCurrency(): string {
    return data.currency ?? 'USD';
  }
}
