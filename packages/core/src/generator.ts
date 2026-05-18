import fs from 'fs-extra';
import { parseAdacFromContent } from '@mindfiredigital/adac-parser';
import { buildElkGraph } from '@mindfiredigital/adac-layout-elk';
import { validateAdacConfig } from '@mindfiredigital/adac-schema';
import { ComplianceChecker } from '@mindfiredigital/adac-compliance';
import {
  OptimizerEngine,
  type OptimizationResult,
} from '@mindfiredigital/adac-optimizer';
import { renderSvg } from './renderer.js';

type CostPeriod = 'hourly' | 'daily' | 'monthly' | 'yearly';

export interface GenerationResult {
  svg: string;
  logs: string[];
  duration: number;
  optimizationResult?: OptimizationResult;
}

const optimizer = new OptimizerEngine();

export async function generateDiagramSvg(
  inputContent: string,
  layoutOverride?: 'elk' | 'dagre' | 'custom',
  validate: boolean = false,
  costData?: Record<string, number>,
  period: CostPeriod = 'monthly',
  skipOptimizer: boolean = false
): Promise<GenerationResult> {
  const logs: string[] = [];
  const start = Date.now();
  const log = (msg: string) =>
    logs.push(`[${new Date().toISOString()}] ${msg}`);

  try {
    log('Starting diagram generation.');
    const adac = parseAdacFromContent(inputContent, { validate: false });

    if (validate) {
      const validation = validateAdacConfig(adac);
      if (!validation.valid) {
        throw new Error(
          `Schema validation failed:\n${validation.errors?.join('\n')}`
        );
      }
      log('Schema validation passed.');
    }

    let optimizationResult: OptimizationResult | undefined;
    if (!skipOptimizer) {
      try {
        optimizationResult = optimizer.analyze(adac);
        const s = optimizationResult.summary;
        log(
          `Optimizer: ${s.total} recommendations (${s.critical} critical, ${s.high} high)`
        );

        optimizationResult.recommendations
          .filter((r) => r.severity === 'critical' || r.severity === 'high')
          .forEach((rec) =>
            log(`[${rec.severity.toUpperCase()}] ${rec.category}: ${rec.title}`)
          );
      } catch (optErr) {
        log(
          `Optimizer error: ${optErr instanceof Error ? optErr.message : String(optErr)}`
        );
      }
    }

    const graph = buildElkGraph(adac);
    const engine = layoutOverride || adac.layout || 'elk';
    const checker = new ComplianceChecker();
    const { byService } = checker.checkCompliance(adac);

    const complianceTooltipMap: Record<
      string,
      { frameworks: string[]; violations: string[] }
    > = {};
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

    const optimizationTooltipMap: Record<
      string,
      { recommendations: string[] }
    > = {};
    if (optimizationResult) {
      for (const [serviceId, recs] of Object.entries(
        optimizationResult.byService
      )) {
        optimizationTooltipMap[serviceId] = {
          recommendations: recs.map((r) => {
            const savings =
              typeof r.estimatedSavingsUsd === 'number'
                ? ` (Est. Savings: $${r.estimatedSavingsUsd.toFixed(2)}/mo)`
                : '';
            return `[${r.severity.toUpperCase()}] ${r.title}${savings}`;
          }),
        };
      }
    }

    const svg = await renderSvg(
      graph,
      engine,
      complianceTooltipMap,
      optimizationTooltipMap,
      costData,
      period
    );

    const duration = Date.now() - start;
    log(`Generation complete in ${duration}ms`);

    return { svg, logs, duration, optimizationResult };
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    log(`Error: ${error.message}`);
    const errorWithLogs = error as Error & { logs?: string[] };
    errorWithLogs.logs = logs;
    throw error;
  }
}

export async function generateDiagram(
  input: string,
  output: string,
  layoutOverride?: 'elk' | 'dagre' | 'custom',
  validate: boolean = false,
  costData?: Record<string, number>,
  period: CostPeriod = 'monthly',
  skipOptimizer: boolean = false
): Promise<void> {
  const raw = await fs.readFile(input, 'utf8');
  const { svg } = await generateDiagramSvg(
    raw,
    layoutOverride,
    validate,
    costData,
    period,
    skipOptimizer
  );
  await fs.outputFile(output, svg);
  console.log(`Diagram generated: ${output}`);
}
