import {
  generateDiagram as coreGenerateDiagram,
  generateDiagramSvg as coreGenerateDiagramSvg,
  type ComplianceTooltipMap,
  type DiagramLayoutEngine,
  type GenerationResult,
} from '@mindfiredigital/adac-core';
import { parseAdacFromContent } from '@mindfiredigital/adac-parser';
import type { AdacConfig } from '@mindfiredigital/adac-validator';
import { ComplianceChecker } from '@mindfiredigital/adac-compliance';
import { validateAdacCostConfig } from '@mindfiredigital/adac-cost';

type CostPeriod = 'hourly' | 'daily' | 'monthly' | 'yearly';

export function buildComplianceTooltipMap(
  adac: AdacConfig
): ComplianceTooltipMap {
  const checker = new ComplianceChecker();
  const { byService } = checker.checkCompliance(adac);
  const complianceTooltipMap: ComplianceTooltipMap = {};

  for (const [serviceId, results] of Object.entries(byService)) {
    const frameworks = results.map((r) => r.framework);
    const violations: string[] = [];

    for (const result of results) {
      if (!result.isCompliant) {
        result.violations.forEach((v) => {
          violations.push(
            `[${result.framework.toUpperCase()} - ${v.severity.toUpperCase()}] ${v.message}`
          );
        });
      }
    }

    complianceTooltipMap[serviceId] = { frameworks, violations };
  }

  return complianceTooltipMap;
}

export async function generateDiagramSvg(
  inputContent: string,
  layoutOverride?: DiagramLayoutEngine,
  validate: boolean = false,
  costData?: Record<string, number>,
  period: CostPeriod = 'monthly',
  skipOptimizer: boolean = false,
  validateCost: boolean = false
): Promise<GenerationResult> {
  if (validateCost) {
    const adac = parseAdacFromContent(inputContent, { validate: false });
    const validation = validateAdacCostConfig(adac);

    if (!validation.valid) {
      throw new Error(
        `Cost validation failed:\n${validation.errors?.join('\n')}`
      );
    }
  }

  return coreGenerateDiagramSvg(
    inputContent,
    layoutOverride,
    validate,
    costData,
    period,
    skipOptimizer,
    buildComplianceTooltipMap
  );
}

export async function generateDiagram(
  input: string,
  output: string,
  layoutOverride?: DiagramLayoutEngine,
  validate: boolean = false,
  costData?: Record<string, number>,
  period: CostPeriod = 'monthly',
  skipOptimizer: boolean = false
): Promise<void> {
  return coreGenerateDiagram(
    input,
    output,
    layoutOverride,
    validate,
    costData,
    period,
    skipOptimizer,
    buildComplianceTooltipMap
  );
}
