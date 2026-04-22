import type { AdacConfig, AdacService } from '@mindfiredigital/adac-schema';
import type { OptimizationRecommendation } from '../types/index.js';

// ─── Reserved-Instance services that support RI pricing ──────────────────────
const RI_ELIGIBLE_SERVICES = new Set([
  'ec2',
  'rds',
  'rds-postgres',
  'rds-mysql',
  'rds-aurora',
  'rds-aurora-postgres',
  'rds-aurora-mysql',
  'elasticache',
  'elasticsearch',
  'opensearch',
  'redshift',
]);

// ─── Services that have Savings-Plan equivalents ──────────────────────────────
const SAVINGS_PLAN_SERVICES = new Set([
  'ec2',
  'ecs-fargate',
  'fargate',
  'lambda',
  'sagemaker',
]);

// ─── Managed alternatives that can replace self-hosted solutions ──────────────
const MANAGED_ALTERNATIVES: Record<string, string> = {
  ec2: 'Consider ECS Fargate or Lambda if workload is containerised.',
  'ecs-ec2': 'Migrate to ECS Fargate to eliminate EC2 capacity management.',
};

/**
 * Emit a recommendation when a service has no cost block defined,
 * making it impossible to model cloud-spend accurately.
 */
function checkMissingCostDefinition(
  serviceId: string,
  service: AdacService
): OptimizationRecommendation | null {
  if (!service.cost || Object.keys(service.cost).length === 0) {
    return {
      id: `cost-no-definition-${serviceId}`,
      title: 'No cost definition found',
      description: `Service "${serviceId}" (${service.service}) has no cost block. Add a cost block to enable accurate spend tracking and savings simulations.`,
      category: 'cost',
      severity: 'info',
      affectedResources: [serviceId],
      actionItems: [
        `Add a "cost" block to service "${serviceId}" in your ADAC YAML.`,
        'Specify at minimum: monthly_usd, billing_model (on-demand|reserved|spot).',
      ],
      referenceUrl: 'https://aws.amazon.com/pricing/',
    };
  }
  return null;
}

/** Suggest Reserved Instance or Savings Plans for eligible on-demand services */
function checkReservedInstanceOpportunity(
  serviceId: string,
  service: AdacService
): OptimizationRecommendation | null {
  const key = service.service?.toLowerCase() ?? '';
  const billingModel = (
    service.cost?.billing_model as string | undefined
  )?.toLowerCase();

  if (RI_ELIGIBLE_SERVICES.has(key) && billingModel === 'on-demand') {
    return {
      id: `cost-ri-opportunity-${serviceId}`,
      title: 'Reserved Instance opportunity detected',
      description: `Service "${serviceId}" (${service.service}) is running on-demand. Switching to a 1-year Reserved Instance can save up to 40% compared to on-demand pricing.`,
      category: 'cost',
      severity: 'medium',
      affectedResources: [serviceId],
      estimatedSavingsUsd: 0, // caller can enrich with actual pricing
      actionItems: [
        `Analyze usage pattern of "${serviceId}" over 30 days.`,
        'Purchase a 1-year or 3-year Reserved Instance in the AWS console.',
        'Switch service billing_model to "reserved" in your ADAC YAML once purchased.',
      ],
      referenceUrl: 'https://aws.amazon.com/ec2/pricing/reserved-instances/',
    };
  }

  if (SAVINGS_PLAN_SERVICES.has(key) && billingModel === 'on-demand') {
    return {
      id: `cost-savings-plan-${serviceId}`,
      title: 'Savings Plan opportunity detected',
      description: `Service "${serviceId}" (${service.service}) can benefit from AWS Savings Plans (up to 66% savings vs on-demand).`,
      category: 'cost',
      severity: 'medium',
      affectedResources: [serviceId],
      actionItems: [
        'Review Compute Savings Plans in the AWS Cost Explorer.',
        `Commit an hourly spend for "${serviceId}" workloads.`,
      ],
      referenceUrl: 'https://aws.amazon.com/savingsplans/',
    };
  }

  return null;
}

/** Suggest managed alternatives when a self-managed pattern is detected */
function checkManagedAlternatives(
  serviceId: string,
  service: AdacService
): OptimizationRecommendation | null {
  const key = service.service?.toLowerCase() ?? '';
  const suggestion = MANAGED_ALTERNATIVES[key];
  if (!suggestion) return null;

  return {
    id: `cost-managed-alternative-${serviceId}`,
    title: 'Managed service alternative available',
    description: `Service "${serviceId}" (${service.service}) is self-managed. ${suggestion}`,
    category: 'cost',
    severity: 'low',
    affectedResources: [serviceId],
    actionItems: [suggestion],
    referenceUrl: 'https://aws.amazon.com/products/',
  };
}

/** Flag services with no monitoring cost tracking */
function checkUnmonitoredHighCost(
  serviceId: string,
  service: AdacService
): OptimizationRecommendation | null {
  const HIGH_COST_SERVICES = new Set([
    'ec2',
    'rds',
    'rds-aurora',
    'rds-aurora-postgres',
    'redshift',
    'elasticsearch',
    'opensearch',
    'elasticache',
  ]);
  const key = service.service?.toLowerCase() ?? '';

  if (HIGH_COST_SERVICES.has(key) && !service.monitoring) {
    return {
      id: `cost-unmonitored-${serviceId}`,
      title: 'High-cost service has no monitoring configured',
      description: `"${serviceId}" (${service.service}) is a historically high-cost service but lacks monitoring configuration. Enable AWS Cost Anomaly Detection or CloudWatch billing alerts.`,
      category: 'cost',
      severity: 'high',
      affectedResources: [serviceId],
      actionItems: [
        `Add a "monitoring" block to "${serviceId}" with at least a billing_alert threshold.`,
        'Enable AWS Cost Anomaly Detection for this service category.',
      ],
      referenceUrl:
        'https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html',
    };
  }
  return null;
}

/**
 * Run all cost optimisation rules against an ADAC config.
 * Returns a flat array of recommendations.
 */
export function runCostRules(config: AdacConfig): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  for (const cloud of config.infrastructure.clouds ?? []) {
    for (const service of cloud.services ?? []) {
      const id = service.id;

      const missing = checkMissingCostDefinition(id, service);
      if (missing) recommendations.push(missing);

      const ri = checkReservedInstanceOpportunity(id, service);
      if (ri) recommendations.push(ri);

      const managed = checkManagedAlternatives(id, service);
      if (managed) recommendations.push(managed);

      const unmonitored = checkUnmonitoredHighCost(id, service);
      if (unmonitored) recommendations.push(unmonitored);
    }
  }

  return recommendations;
}
