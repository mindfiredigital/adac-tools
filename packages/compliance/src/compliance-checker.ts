import { AdacConfig } from '@mindfiredigital/adac-schema';
import { RuleEvaluator, ServiceComplianceMap } from './evaluator';
import { RemediationEngine } from './remediation/remediation-engine';
import { ComplianceResult } from './types';

export class ComplianceChecker {
  private evaluator: RuleEvaluator;
  private remediationEngine: RemediationEngine;

  constructor() {
    this.evaluator = new RuleEvaluator();
    this.remediationEngine = new RemediationEngine();
  }

  /**
   * Evaluates every service in the config that declares a `compliance` field.
   * No options are required — the frameworks are read from the YAML itself.
   *
   * Returns:
   *   - `byService`       : ServiceComplianceMap  (serviceId → ComplianceResult[])
   *   - `results`         : flat ComplianceResult[] for backwards-compat consumers
   *   - `remediationPlan` : deduplicated remediation steps across all violations
   */
  public checkCompliance(config: AdacConfig): {
    byService: ServiceComplianceMap;
    results: ComplianceResult[];
    remediationPlan: {
      id: string;
      resourceId: string;
      frameworks: string[];
      steps: string[];
      severity: string;
    }[];
  } {
    const byService = this.evaluator.evaluate(config);

    // Flatten all per-service results into a single array for legacy consumers
    const results: ComplianceResult[] = [];
    for (const serviceResults of Object.values(byService)) {
      results.push(...serviceResults);
    }

    const remediationPlan =
      this.remediationEngine.generateRemediationPlan(results);

    return { byService, results, remediationPlan };
  }
}
