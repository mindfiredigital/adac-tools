import { ComplianceRule } from '../types';

export const requireLoggingRule: ComplianceRule = {
  id: 'log-01',
  frameworks: ['pci-dss', 'soc2', 'hipaa', 'iso27001', 'fedramp'],
  name: 'Require Logging',
  description: 'Services should have appropriate logging enabled',
  severity: 'medium',
  evaluate(service) {
    if (
      ['alb', 'api-gateway', 's3', 'cloudfront', 'cloud-load-balancing', 'cloud-storage', 'gcs', 'cloud-cdn'].includes(service.service)
    ) {
      const config = (service.config || service.configuration) as Record<
        string,
        unknown
      >;
      if (!config?.loggingEnabled && !config?.accessLogs) {
        return {
          id: 'log-01',
          resourceId: service.id,
          framework: '',
          severity: 'medium',
          message: `Logging is not explicitly enabled for ${service.name || service.id}.`,
          remediation: {
            id: 'rem-log-01',
            description:
              'Enable access logs or standard logging for the service.',
            actionableSteps: [`Enable logging in ${service.id} configuration.`],
            references: [],
          },
        };
      }
    }
    return null;
  },
};
