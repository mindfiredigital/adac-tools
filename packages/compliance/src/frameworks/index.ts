import { ComplianceRule } from '../types';
import * as rules from '../rules';

// Grouping all rules
export const allRules: ComplianceRule[] = Object.values(rules);

export const getRulesForFramework = (framework: string): ComplianceRule[] => {
  return allRules.filter((rule) => rule.frameworks.includes(framework));
};
