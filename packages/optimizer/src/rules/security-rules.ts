import type { AdacConfig, AdacService } from '@mindfiredigital/adac-schema';
import type { OptimizationRecommendation } from '../types/index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Services that handle sensitive data and must be encrypted */
const ENCRYPTION_REQUIRED = new Set([
  'rds',
  'rds-postgres',
  'rds-mysql',
  'rds-aurora',
  'rds-aurora-postgres',
  'rds-aurora-mysql',
  'dynamodb',
  'elasticache',
  'redshift',
  's3',
  'ebs',
  'efs',
  'sns',
  'sqs',
]);

/** Services that should have IAM roles explicitly declared */
const IAM_REQUIRED = new Set([
  'ec2',
  'ecs',
  'ecs-fargate',
  'fargate',
  'lambda',
  'eks',
  'sagemaker',
  'glue',
]);

/** Services that should be placed inside a VPC / subnet */
const VPC_SENSITIVE = new Set([
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
  'redshift',
]);

// ─── Rules ────────────────────────────────────────────────────────────────────

/** Warn when encryption_at_rest is missing or false for sensitive services */
function checkEncryption(
  serviceId: string,
  service: AdacService
): OptimizationRecommendation | null {
  const key = service.service?.toLowerCase() ?? '';
  if (!ENCRYPTION_REQUIRED.has(key)) return null;

  const cfg = service.configuration ?? {};
  const encrypted =
    cfg['encrypted'] === true ||
    cfg['encryption'] === true ||
    cfg['encryption_at_rest'] === true ||
    cfg['storageEncrypted'] === true;

  if (!encrypted) {
    return {
      id: `security-no-encryption-${serviceId}`,
      title: 'Encryption at rest not configured',
      description: `Service "${serviceId}" (${service.service}) stores potentially sensitive data but encryption at rest is not enabled. Enable encryption to meet compliance requirements and protect against data breaches.`,
      category: 'security',
      severity: 'critical',
      affectedResources: [serviceId],
      actionItems: [
        `Set configuration.encrypted: true for "${serviceId}".`,
        'Use AWS KMS Customer Managed Keys (CMK) for additional control.',
        'Rotate encryption keys at least annually.',
      ],
      referenceUrl:
        'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/protecting-data-at-rest.html',
    };
  }
  return null;
}

/** Warn when an IAM role is not declared for compute services */
function checkIamRole(
  serviceId: string,
  service: AdacService
): OptimizationRecommendation | null {
  const key = service.service?.toLowerCase() ?? '';
  if (!IAM_REQUIRED.has(key)) return null;

  if (!service.iam_role) {
    return {
      id: `security-no-iam-role-${serviceId}`,
      title: 'IAM role not declared',
      description: `Service "${serviceId}" (${service.service}) has no IAM role specified. Without a scoped role, it may run with default/admin permissions, violating the principle of least privilege.`,
      category: 'security',
      severity: 'high',
      affectedResources: [serviceId],
      actionItems: [
        `Define a dedicated IAM role for "${serviceId}" with only required permissions.`,
        'Avoid using overly permissive policies (e.g. AdministratorAccess).',
        'Enable AWS IAM Access Analyzer to detect unused permissions.',
      ],
      referenceUrl:
        'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html',
    };
  }
  return null;
}

/** Warn when sensitive services are not placed inside a VPC */
function checkVpcPlacement(
  serviceId: string,
  service: AdacService,
  hasVpc: boolean
): OptimizationRecommendation | null {
  const key = service.service?.toLowerCase() ?? '';
  if (!VPC_SENSITIVE.has(key)) return null;

  const hasSubnets =
    (service.subnets && service.subnets.length > 0) ||
    (service.security_groups && service.security_groups.length > 0);

  if (!hasVpc && !hasSubnets) {
    return {
      id: `security-no-vpc-${serviceId}`,
      title: 'Sensitive service not placed in a VPC',
      description: `Service "${serviceId}" (${service.service}) handles sensitive data but is not placed within a VPC. Publicly accessible data stores are a critical security risk.`,
      category: 'security',
      severity: 'critical',
      affectedResources: [serviceId],
      actionItems: [
        `Move "${serviceId}" into a private subnet of a VPC.`,
        'Add security_groups restricting inbound access to only known CIDR ranges.',
        'Disable public accessibility (e.g. RDS publicly_accessible: false).',
      ],
      referenceUrl:
        'https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/network-protection.html',
    };
  }
  return null;
}

/** Check for services that should have security groups but don't */
function checkSecurityGroups(
  serviceId: string,
  service: AdacService
): OptimizationRecommendation | null {
  const NEEDS_SG = new Set([
    'ec2',
    'rds',
    'elasticache',
    'redshift',
    'ecs',
    'ecs-fargate',
    'fargate',
    'alb',
    'nlb',
    'load-balancer',
  ]);
  const key = service.service?.toLowerCase() ?? '';
  if (!NEEDS_SG.has(key)) return null;

  if (!service.security_groups || service.security_groups.length === 0) {
    return {
      id: `security-no-sg-${serviceId}`,
      title: 'No security groups defined',
      description: `Service "${serviceId}" (${service.service}) has no security groups configured. Explicitly declare security groups to limit network exposure.`,
      category: 'security',
      severity: 'high',
      affectedResources: [serviceId],
      actionItems: [
        `Add a security_groups list to "${serviceId}".`,
        'Use the principle of least privilege: only open required ports.',
        'Avoid 0.0.0.0/0 ingress rules except for public-facing load balancers over HTTPS.',
      ],
      referenceUrl:
        'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html',
    };
  }
  return null;
}

/**
 * Run all security optimisation rules against an ADAC config.
 */
export function runSecurityRules(
  config: AdacConfig
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  for (const cloud of config.infrastructure.clouds ?? []) {
    const hasVpc = !!cloud.vpc_id;

    for (const service of cloud.services ?? []) {
      const id = service.id;

      const enc = checkEncryption(id, service);
      if (enc) recommendations.push(enc);

      const iam = checkIamRole(id, service);
      if (iam) recommendations.push(iam);

      const vpc = checkVpcPlacement(id, service, hasVpc);
      if (vpc) recommendations.push(vpc);

      const sg = checkSecurityGroups(id, service);
      if (sg) recommendations.push(sg);
    }
  }

  return recommendations;
}
