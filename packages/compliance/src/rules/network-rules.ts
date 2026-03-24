import { ComplianceRule } from '../types';

export const requirePrivateSubnetsRule: ComplianceRule = {
  id: 'net-01',
  frameworks: ['pci-dss', 'soc2', 'iso27001'],
  name: 'Require Private Subnets for Databases',
  description: 'Databases should not be placed in public subnets',
  severity: 'critical',
  evaluate(service) {
    if (
      [
        'rds',
        'dynamodb',
        'databases',
        'cloud-sql',
        'cloudsql',
        'cloud-spanner',
        'firestore',
        'bigtable',
      ].includes(service.service)
    ) {
      const config = (service.config || service.configuration) as Record<
        string,
        unknown
      >;
      if (
        config?.publiclyAccessible === true ||
        config?.subnetType === 'public' ||
        config?.public_ip_enabled === true
      ) {
        return {
          id: 'net-01',
          resourceId: service.id,
          framework: '',
          severity: 'critical',
          message: `Database ${service.name || service.id} is publicly accessible or located in a public subnet.`,
          remediation: {
            id: 'rem-net-01',
            description:
              'Move database to a private subnet and disable public access.',
            actionableSteps: [
              `Set 'publiclyAccessible: false' for ${service.id}.`,
              `Ensure ${service.id} is attached to private subnets only.`,
            ],
            references: [
              'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.Security.html',
            ],
          },
        };
      }
    }
    return null;
  },
};
