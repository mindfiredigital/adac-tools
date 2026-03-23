import { ComplianceRule } from '../types';

export const requireMonitoringRule: ComplianceRule = {
  id: 'mon-01',
  frameworks: ['soc2', 'iso27001'],
  name: 'Require Monitoring',
  description:
    'Critical components should have monitoring enabled (e.g. CloudWatch alarms).',
  severity: 'medium',
  evaluate(service) {
    // Checking if a service has a monitoring configuration attached.
    if (
      [
        'ec2',
        'rds',
        'ecs',
        'compute-engine',
        'gce',
        'cloud-sql',
        'cloudsql',
        'gke',
        'cloud-run',
      ].includes(service.service)
    ) {
      const monitoring = service.monitoring as Record<string, unknown>;
      if (!monitoring || !monitoring.enabled) {
        return {
          id: 'mon-01',
          resourceId: service.id,
          framework: '',
          severity: 'medium',
          message: `Monitoring is not enabled for service ${service.name || service.id}.`,
          remediation: {
            id: 'rem-mon-01',
            description:
              'Enable enhanced monitoring and configure alarms for the service.',
            actionableSteps: [
              `Add 'monitoring.enabled: true' for ${service.id}.`,
            ],
            references: [],
          },
        };
      }
    }
    return null;
  },
};
