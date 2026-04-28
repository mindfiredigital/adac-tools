import type { AdacConfig, AdacService } from '@mindfiredigital/adac-schema';
import type { OptimizationRecommendation } from '../types/index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Services that benefit strongly from multi-AZ deployment */
const MULTI_AZ_CANDIDATES = new Set([
  'rds',
  'rds-postgres',
  'rds-mysql',
  'rds-aurora',
  'rds-aurora-postgres',
  'rds-aurora-mysql',
  'elasticache',
  'redis',
  'memcached',
  'elasticsearch',
  'opensearch',
  'alb',
  'nlb',
  'load-balancer',
]);

/** Services that support auto-scaling */
const AUTO_SCALING_CANDIDATES = new Set([
  'ec2',
  'ecs',
  'ecs-fargate',
  'fargate',
  'eks',
  'lambda',
  'dynamodb',
  'aurora',
  'rds-aurora',
  'rds-aurora-postgres',
  'rds-aurora-mysql',
]);

/** Services that typically need backups configured */
const BACKUP_CANDIDATES = new Set([
  'rds',
  'rds-postgres',
  'rds-mysql',
  'rds-aurora',
  'rds-aurora-postgres',
  'rds-aurora-mysql',
  'dynamodb',
  'elasticache',
  's3',
  'efs',
  'ebs',
  'documentdb',
]);

// ─── Rules ────────────────────────────────────────────────────────────────────

/** Flag services that should be multi-AZ but lack AZ configuration */
function checkMultiAz(
  serviceId: string,
  service: AdacService
): OptimizationRecommendation | null {
  const key = service.service?.toLowerCase() ?? '';
  if (!MULTI_AZ_CANDIDATES.has(key)) return null;

  const azs = service.availability_zones ?? [];
  if (azs.length < 2) {
    return {
      id: `reliability-no-multi-az-${serviceId}`,
      title: 'Single-AZ deployment detected',
      description: `Service "${serviceId}" (${service.service}) is configured in fewer than two Availability Zones. A single-AZ failure would cause downtime for this service.`,
      category: 'reliability',
      severity: 'high',
      affectedResources: [serviceId],
      actionItems: [
        `Add at least 2 entries to availability_zones for "${serviceId}".`,
        'For RDS, enable Multi-AZ deployment in configuration.',
        'For ElastiCache, enable Multi-AZ with automatic failover.',
      ],
      referenceUrl:
        'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/use-fault-isolation-to-protect-your-workload.html',
    };
  }
  return null;
}

/** Flag compute services with no auto-scaling policy */
function checkAutoScaling(
  serviceId: string,
  service: AdacService
): OptimizationRecommendation | null {
  const key = service.service?.toLowerCase() ?? '';
  if (!AUTO_SCALING_CANDIDATES.has(key)) return null;

  const cfg = service.configuration ?? {};
  const hasScaling =
    cfg['auto_scaling'] !== undefined ||
    cfg['autoscaling'] !== undefined ||
    cfg['min_capacity'] !== undefined ||
    cfg['scaling_policy'] !== undefined;

  if (!hasScaling) {
    return {
      id: `reliability-no-autoscaling-${serviceId}`,
      title: 'No auto-scaling configuration found',
      description: `Service "${serviceId}" (${service.service}) has no auto-scaling policy. Traffic spikes will cause degraded performance or service outages.`,
      category: 'reliability',
      severity: 'medium',
      affectedResources: [serviceId],
      actionItems: [
        `Add auto_scaling configuration to "${serviceId}" (min/max capacity, scaling policy).`,
        'Use target tracking scaling for CPU/memory utilisation.',
        'Configure scale-in protection for stateful services.',
      ],
      referenceUrl:
        'https://docs.aws.amazon.com/autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html',
    };
  }
  return null;
}

/** Flag services that should have backup configured */
function checkBackupPolicy(
  serviceId: string,
  service: AdacService
): OptimizationRecommendation | null {
  const key = service.service?.toLowerCase() ?? '';
  if (!BACKUP_CANDIDATES.has(key)) return null;

  const cfg = service.configuration ?? {};
  const hasBackup =
    cfg['backup'] !== undefined ||
    cfg['backup_retention_period'] !== undefined ||
    cfg['backup_window'] !== undefined ||
    cfg['point_in_time_recovery'] !== undefined;

  if (!hasBackup) {
    return {
      id: `reliability-no-backup-${serviceId}`,
      title: 'Backup policy not configured',
      description: `Service "${serviceId}" (${service.service}) stores data but has no backup configuration. Data may be unrecoverable after accidental deletion or corruption.`,
      category: 'reliability',
      severity: 'high',
      affectedResources: [serviceId],
      actionItems: [
        `Add backup_retention_period (minimum 7 days) to "${serviceId}".`,
        'Configure a backup_window during off-peak hours.',
        'Periodically test backup restoration in a staging environment.',
      ],
      referenceUrl:
        'https://docs.aws.amazon.com/aws-backup/latest/devguide/whatisbackup.html',
    };
  }
  return null;
}

/** Detect single points of failure — services with no redundancy and no load-balancer upstream */
function checkSinglePointOfFailure(
  config: AdacConfig
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];
  const connections = config.connections ?? [];

  // Build a set of services that are the target of a load balancer
  const loadBalanced = new Set<string>();
  for (const conn of connections) {
    const from = conn.from?.toLowerCase();
    if (
      from?.includes('alb') ||
      from?.includes('nlb') ||
      from?.includes('load-balancer') ||
      conn.type?.toLowerCase() === 'load-balancing'
    ) {
      loadBalanced.add(conn.to);
    }
  }

  for (const cloud of config.infrastructure.clouds ?? []) {
    for (const service of cloud.services ?? []) {
      const key = service.service?.toLowerCase() ?? '';

      // If it's a user-facing app tier but not load-balanced
      const isAppTier =
        key === 'ec2' ||
        key === 'ecs' ||
        key === 'ecs-fargate' ||
        key === 'fargate';
      const azCount = (service.availability_zones ?? []).length;

      if (isAppTier && !loadBalanced.has(service.id) && azCount < 2) {
        recommendations.push({
          id: `reliability-spof-${service.id}`,
          title: 'Potential single point of failure',
          description: `Service "${service.id}" (${service.service}) is a compute tier with no load balancer upstream and only ${azCount} AZ(s). A failure will take the service offline.`,
          category: 'reliability',
          severity: 'high',
          affectedResources: [service.id],
          actionItems: [
            'Add an ALB or NLB upstream of this compute service.',
            'Deploy instances across at least 2 Availability Zones.',
            'Implement health checks so unhealthy instances are replaced automatically.',
          ],
          referenceUrl:
            'https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/design-your-workload-to-withstand-component-failures.html',
        });
      }
    }
  }

  return recommendations;
}

/** Detect orphaned services (no connections in or out) */
function checkOrphanedServices(
  config: AdacConfig
): OptimizationRecommendation[] {
  const connections = config.connections ?? [];
  const connected = new Set<string>();
  for (const c of connections) {
    connected.add(c.from);
    if (c.to) connected.add(c.to);
    if (c.source) connected.add(c.source);
    if (c.target) connected.add(c.target);
  }

  const recommendations: OptimizationRecommendation[] = [];
  for (const cloud of config.infrastructure.clouds ?? []) {
    for (const service of cloud.services ?? []) {
      if (!connected.has(service.id) && connections.length > 0) {
        recommendations.push({
          id: `architecture-orphan-${service.id}`,
          title: 'Orphaned service — no connections defined',
          description: `Service "${service.id}" (${service.service}) has no connections in or out. It may be unused, misconfigured, or missing a connection definition.`,
          category: 'architecture',
          severity: 'medium',
          affectedResources: [service.id],
          actionItems: [
            `Verify whether "${service.id}" is actively used.`,
            'Add appropriate connections in the ADAC YAML if it is required.',
            'Remove the service definition if it is no longer needed.',
          ],
        });
      }
    }
  }
  return recommendations;
}

/**
 * Run all reliability & architecture optimisation rules.
 */
export function runReliabilityRules(
  config: AdacConfig
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  for (const cloud of config.infrastructure.clouds ?? []) {
    for (const service of cloud.services ?? []) {
      const id = service.id;

      const az = checkMultiAz(id, service);
      if (az) recommendations.push(az);

      const as_ = checkAutoScaling(id, service);
      if (as_) recommendations.push(as_);

      const bk = checkBackupPolicy(id, service);
      if (bk) recommendations.push(bk);
    }
  }

  recommendations.push(...checkSinglePointOfFailure(config));
  recommendations.push(...checkOrphanedServices(config));

  return recommendations;
}
