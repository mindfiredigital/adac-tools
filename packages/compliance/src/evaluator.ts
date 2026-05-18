import { AdacConfig, AdacService } from '@mindfiredigital/adac-schema';
import { ComplianceResult, Violation } from './types';
import { getRulesForFramework } from './frameworks';

/** Normalize framework names to lowercase (YAML may use 'PCI-DSS' or 'pci-dss') */
const normalizeFramework = (fw: string): string => fw.toLowerCase().trim();

export class RuleEvaluator {
  /**
   * Evaluate compliance for all services that declare a `compliance` field in
   * the YAML. Services without a `compliance` array are skipped entirely.
   *
   * Returns one ComplianceResult per (service × framework) combination, keyed
   * and grouped so downstream consumers can build per-service tooltips.
   */
  public evaluate(config: AdacConfig): ServiceComplianceMap {
    const map: ServiceComplianceMap = {};

    // Flatten all services across all clouds
    const allServices: AdacService[] = [];
    if (config.infrastructure && config.infrastructure.clouds) {
      for (const cloud of config.infrastructure.clouds) {
        if (cloud.services) {
          allServices.push(...cloud.services);
        }
      }
    }

    for (const service of allServices) {
      // Only process services that explicitly declare compliance requirements
      if (!service.compliance || service.compliance.length === 0) {
        continue;
      }

      const frameworks = service.compliance.map(normalizeFramework);
      const results: ComplianceResult[] = [];

      for (const framework of frameworks) {
        const rules = getRulesForFramework(framework);
        const violations: Violation[] = [];

        for (const rule of rules) {
          const violation = rule.evaluate(service, { config });
          if (violation) {
            violation.framework = framework;
            violations.push(violation);
          }
        }

        const critical = violations.filter(
          (v) => v.severity === 'critical'
        ).length;
        const high = violations.filter((v) => v.severity === 'high').length;
        const medium = violations.filter((v) => v.severity === 'medium').length;
        const low = violations.filter((v) => v.severity === 'low').length;

        results.push({
          framework,
          isCompliant: violations.length === 0,
          violations,
          summary: { critical, high, medium, low, total: violations.length },
        });
      }

      map[service.id] = results;
    }

    return map;
  }
}

/**
 * Keyed by serviceId → array of per-framework ComplianceResult.
 * Services without a `compliance` field are absent from this map.
 */
export type ServiceComplianceMap = Record<string, ComplianceResult[]>;
