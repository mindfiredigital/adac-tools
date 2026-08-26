import { parseAdacFromContent } from '@mindfiredigital/adac-parser';
import { buildElkGraph } from '@mindfiredigital/adac-layout-elk';
import {
  validateAdacConfig,
  type AdacConfig,
} from '@mindfiredigital/adac-validator';
import {
  OptimizerEngine,
  type OptimizationResult,
} from '@mindfiredigital/adac-layout-core';
import { renderSvg } from './renderer.js';

let fsPromise: Promise<typeof import('fs-extra')> | undefined;

const getFs = () => (fsPromise ??= import('fs-extra').then((m) => m.default));

type CostPeriod = 'hourly' | 'daily' | 'monthly' | 'yearly';
export type DiagramLayoutEngine = 'elk' | 'custom' | 'orthogonal' | 'tsm';

export type ComplianceTooltipMap = Record<
  string,
  { frameworks: string[]; violations: string[] }
>;

export type ComplianceTooltipProvider = (
  adac: AdacConfig
) => ComplianceTooltipMap | Promise<ComplianceTooltipMap>;

export type IconResolver = (iconName: string) => Promise<string | null>;

export interface GenerationResult {
  svg: string;
  logs: string[];
  duration: number;
  optimizationResult?: OptimizationResult;
}

const optimizer = new OptimizerEngine();

export async function generateDiagramSvg(
  inputContent: string,
  layoutOverride?: DiagramLayoutEngine,
  validate: boolean = false,
  costData?: Record<string, number>,
  period: CostPeriod = 'monthly',
  skipOptimizer: boolean = false,
  complianceProvider?: ComplianceTooltipProvider,
  iconResolver?: IconResolver
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

    const graph = await buildElkGraph(adac);
    const engine = normalizeLayoutEngine(
      layoutOverride ?? adac.layout ?? 'custom'
    );

    let complianceTooltipMap: ComplianceTooltipMap | undefined;

    try {
      complianceTooltipMap = complianceProvider
        ? await complianceProvider(adac)
        : undefined;
    } catch (compErr) {
      log(
        `Compliance provider error: ${compErr instanceof Error ? compErr.message : String(compErr)}`
      );
      complianceTooltipMap = undefined;
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
      period,
      iconResolver
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
  layoutOverride?: DiagramLayoutEngine,
  validate: boolean = false,
  costData?: Record<string, number>,
  period: CostPeriod = 'monthly',
  skipOptimizer: boolean = false,
  complianceProvider?: ComplianceTooltipProvider,
  iconResolver?: IconResolver
): Promise<void> {
  const fs = await getFs();
  const raw = await fs.readFile(input, 'utf8');
  const { svg } = await generateDiagramSvg(
    raw,
    layoutOverride,
    validate,
    costData,
    period,
    skipOptimizer,
    complianceProvider,
    iconResolver
  );
  await fs.outputFile(output, svg);
  console.log(`Diagram generated: ${output}`);
}

function normalizeLayoutEngine(value: unknown): DiagramLayoutEngine {
  if (
    value === 'elk' ||
    value === 'custom' ||
    value === 'orthogonal' ||
    value === 'tsm'
  ) {
    return value;
  }

  throw new Error(
    `Unsupported layout engine "${String(value)}". Expected elk, custom, orthogonal, or tsm.`
  );
}
