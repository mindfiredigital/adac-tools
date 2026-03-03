import { ComplianceRule } from '../types';

export const requireStorageEncryptionRule: ComplianceRule = {
  id: 'enc-01',
  frameworks: ['pci-dss', 'hipaa', 'gdpr', 'soc2'],
  name: 'Require Storage Encryption',
  description: 'All data at rest must be encrypted',
  severity: 'high',
  evaluate(service) {
    if (service.service === 's3' || service.service === 'rds') {
      const config = (service.config || service.configuration) as Record<
        string,
        unknown
      >;
      if (
        !config?.encrypted &&
        !config?.sseAlgorithm &&
        !config?.storageEncrypted
      ) {
        return {
          id: 'enc-01',
          resourceId: service.id,
          framework: '', // assigned by evaluator
          severity: 'high',
          message: `Service ${service.name || service.id} does not have encryption enabled at rest.`,
          remediation: {
            id: 'rem-enc-01',
            description: 'Enable encryption at rest for this service.',
            actionableSteps: [
              `Enable encryption in the configuration of ${service.id} by setting 'encrypted: true' or a similar property.`,
            ],
            references: ['https://aws.amazon.com/compliance/'],
          },
        };
      }
    }
    return null;
  },
};
