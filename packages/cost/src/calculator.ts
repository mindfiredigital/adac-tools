import type { AdacConfig, AdacService } from '@mindfiredigital/adac-schema';
import type {
  CostBreakdown,
  ServiceCost,
  CostCategory,
  CostLineItem,
} from './types/index.js';
import { getPricingForService } from './pricing/aws-pricing.js';

/**
 * CostCalculator — analyses an AdacConfig and produces a cost breakdown.
 *
 * It reads the `cost` field on each service if present (user-supplied estimates).
 * When a `cost.monthly_estimate` is supplied the calculator honours it; otherwise
 * it falls back to the embedded pricing catalogue.
 */
export class CostCalculator {
  /**
   * Calculate cost breakdown for every service in the ADAC config.
   */
  public calculate(config: AdacConfig): CostBreakdown {
    const byService: Record<string, ServiceCost> = {};
    const byCategory: Record<CostCategory, number> = {
      compute: 0,
      database: 0,
      storage: 0,
      networking: 0,
      monitoring: 0,
      security: 0,
      messaging: 0,
      analytics: 0,
      other: 0,
    };

    if (config.infrastructure?.clouds) {
      for (const cloud of config.infrastructure.clouds) {
        if (!cloud.services) continue;
        for (const service of cloud.services) {
          const cost = this.calculateServiceCost(service, cloud.provider);
          byService[service.id] = cost;
          byCategory[cost.category] += cost.monthlyEstimate;
        }
      }
    }

    const totalMonthly = Object.values(byService).reduce(
      (sum, s) => sum + s.monthlyEstimate,
      0
    );

    return {
      totalMonthly,
      totalYearly: totalMonthly * 12,
      currency: 'USD',
      byService,
      byCategory,
      serviceCount: Object.keys(byService).length,
    };
  }

  /**
   * Calculate cost for a single service.
   */
  private calculateServiceCost(
    service: AdacService,
    provider: string
  ): ServiceCost {
    const serviceType = service.service || service.type || '';
    const pricing = getPricingForService(serviceType, provider);

    // Check if the user has supplied a cost estimate in the YAML
    const userCost = service.cost as Record<string, unknown> | undefined;
    const userEstimate =
      (userCost?.monthly_estimate as number) ??
      (userCost?.monthlyEstimate as number) ??
      undefined;

    const monthlyEstimate =
      userEstimate !== undefined
        ? userEstimate
        : (pricing?.defaultMonthly ?? 0);

    const category = pricing?.category ?? this.inferCategory(serviceType);

    const breakdown: CostLineItem[] = [];
    if (pricing) {
      breakdown.push({
        description: pricing.description,
        quantity: 1,
        unit: pricing.unit,
        unitPrice: monthlyEstimate,
        total: monthlyEstimate,
      });
    }

    return {
      serviceId: service.id,
      serviceName: service.name || service.id,
      serviceType,
      monthlyEstimate,
      breakdown,
      pricingModel: pricing?.pricingModel ?? 'on-demand',
      category,
    };
  }

  /**
   * Best-effort category inference when a service isn't in the pricing catalog.
   */
  private inferCategory(serviceType: string): CostCategory {
    const s = serviceType.toLowerCase();

    if (
      [
        'ec2',
        'ecs',
        'lambda',
        'compute',
        'fargate',
        'gce',
        'gke',
        'cloud-run',
        'cloud-functions',
        'vertex-ai',
      ].some((k) => s.includes(k))
    )
      return 'compute';
    if (
      [
        'rds',
        'dynamo',
        'sql',
        'spanner',
        'bigtable',
        'alloydb',
        'memorystore',
        'firestore',
        'database',
      ].some((k) => s.includes(k))
    )
      return 'database';
    if (
      ['s3', 'storage', 'glacier', 'ebs', 'artifact'].some((k) => s.includes(k))
    )
      return 'storage';
    if (
      [
        'vpc',
        'alb',
        'elb',
        'cloudfront',
        'route53',
        'cdn',
        'load-balancing',
        'nat',
        'api-gateway',
        'network',
      ].some((k) => s.includes(k))
    )
      return 'networking';
    if (['cloudwatch', 'monitoring', 'logging'].some((k) => s.includes(k)))
      return 'monitoring';
    if (
      ['iam', 'waf', 'kms', 'cognito', 'secret', 'armor', 'security'].some(
        (k) => s.includes(k)
      )
    )
      return 'security';
    if (
      ['sqs', 'sns', 'eventbridge', 'pubsub', 'kinesis'].some((k) =>
        s.includes(k)
      )
    )
      return 'messaging';
    if (
      [
        'athena',
        'bigquery',
        'glue',
        'emr',
        'redshift',
        'quicksight',
        'dataflow',
      ].some((k) => s.includes(k))
    )
      return 'analytics';

    return 'other';
  }
}
