import { ComplianceResult } from '../types';

export class RemediationEngine {
  constructor() {}

  /**
   * Aggregates and returns a unique set of actionable steps
   * from all violations found in the compliance results.
   */
  public generateRemediationPlan(results: ComplianceResult[]): {
    id: string;
    resourceId: string;
    frameworks: string[];
    steps: string[];
    severity: string;
  }[] {
    const planMap = new Map<
      string,
      {
        id: string;
        resourceId: string;
        frameworks: string[];
        steps: string[];
        severity: string;
      }
    >();

    for (const result of results) {
      for (const violation of result.violations) {
        const mapKey = `${violation.resourceId}-${violation.id}`;
        if (!planMap.has(mapKey)) {
          planMap.set(mapKey, {
            id: violation.remediation.id,
            resourceId: violation.resourceId,
            frameworks: [result.framework],
            steps: [...violation.remediation.actionableSteps],
            severity: violation.severity,
          });
        } else {
          const existing = planMap.get(mapKey)!;
          if (!existing.frameworks.includes(result.framework)) {
            existing.frameworks.push(result.framework);
          }
        }
      }
    }

    return Array.from(planMap.values());
  }
}
