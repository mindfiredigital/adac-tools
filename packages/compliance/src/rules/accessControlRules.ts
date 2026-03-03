import { ComplianceRule } from '../types';

export const requireLeastPrivilegeRule: ComplianceRule = {
  id: 'iam-01',
  frameworks: ['pci-dss', 'soc2', 'hipaa', 'iso27001', 'fedramp'],
  name: 'Require Least Privilege IAM Policies',
  description: 'Avoid wildcard actions in IAM policies',
  severity: 'high',
  evaluate(service) {
    if (service.service === 'iam-role' || service.service === 'iam-policy') {
      const config = (service.config || service.configuration) as Record<
        string,
        unknown
      >;
      const policyDocument = config?.policyDocument || config?.policy;
      if (policyDocument && typeof policyDocument === 'string') {
        if (
          policyDocument.includes('"Action":"*"') ||
          policyDocument.includes('"Action": "*"')
        ) {
          return {
            id: 'iam-01',
            resourceId: service.id,
            framework: '',
            severity: 'high',
            message: `IAM resource ${service.name || service.id} contains wildcard actions.`,
            remediation: {
              id: 'rem-iam-01',
              description: 'Remove wildcard ("*") actions from IAM policies.',
              actionableSteps: [
                `Update policy for ${service.id} to explicitly specify allowed actions instead of using "*".`,
              ],
              references: [],
            },
          };
        }
      }
    }
    return null;
  },
};
