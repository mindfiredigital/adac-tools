import { RemediationSuggestion } from './remediation';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface Violation {
  id: string; // rule id
  resourceId: string; // ID of the resource (service)
  framework: string; // e.g. pci-dss
  severity: Severity;
  message: string;
  remediation: RemediationSuggestion;
}
