import { describe, it, expect } from 'vitest';
import { AWSPricing } from '../src/pricing/aws-pricing';

describe('AWSPricing', () => {
  const pricing = new AWSPricing();

  it('should return a positive EC2 hourly price for t3.medium', () => {
    const onDemandPrice = pricing.getEC2HourlyPrice('t3.medium');
    const reservedPrice = pricing.getEC2HourlyPrice('t3.medium', 'reserved');
    expect(onDemandPrice).toBeGreaterThan(0);
    expect(reservedPrice).toBeGreaterThan(0);
    expect(onDemandPrice).not.toBe(reservedPrice);
  });

  it('should return 0 for unknown instance type', () => {
    const price = pricing.getEC2HourlyPrice('unknown.type');
    expect(price).toBe(0);
  });

  it('should return Fargate prices', () => {
    expect(pricing.getFargateVcpuPrice()).toBeGreaterThan(0);
    expect(pricing.getFargateMemoryPrice()).toBeGreaterThan(0);
  });

  it('should return Lambda prices', () => {
    expect(pricing.getLambdaRequestPrice()).toBeGreaterThan(0);
    expect(pricing.getLambdaComputePrice()).toBeGreaterThan(0);
  });

  it('should return RDS prices', () => {
    expect(pricing.getRDSHourlyPrice('db.t3.micro')).toBeGreaterThan(0);
    expect(pricing.getDynamoDBReadPrice()).toBeGreaterThan(0);
    expect(pricing.getDynamoDBWritePrice()).toBeGreaterThan(0);
    expect(pricing.getDynamoDBStoragePrice()).toBeGreaterThan(0);
  });

  it('should return S3 and EBS prices', () => {
    expect(pricing.getS3Price('standard')).toBeGreaterThan(0);
    expect(pricing.getEBSPrice('gp3')).toBeGreaterThan(0);
  });

  it('should return networking prices', () => {
    expect(pricing.getDataTransferPrice('internet_out')).toBeGreaterThan(0);
    expect(pricing.getALBHourlyPrice()).toBeGreaterThan(0);
    expect(pricing.getALBLCUPrice()).toBeGreaterThan(0);
  });

  it('should return metadata', () => {
    expect(pricing.getLastUpdated()).toBeDefined();
    expect(pricing.getCurrency()).toBe('USD');
  });
});
