import fs from 'fs-extra';
import { parseAdacFromContent } from '@mindfiredigital/adac-parser';
import { buildElkGraph } from '@mindfiredigital/adac-layout-elk';
import { validateAdacConfig } from '@mindfiredigital/adac-schema';
import { ComplianceChecker } from '@mindfiredigital/adac-compliance';
import { renderSvg } from './renderer.js';

type CostPeriod = 'hourly' | 'daily' | 'monthly' | 'yearly';

export interface GenerationResult {
  svg: string;
  logs: string[];
  duration: number;
}

export async function generateDiagramSvg(
  inputContent: string,
  layoutOverride?: 'elk' | 'dagre',
  validate: boolean = false,
  costData?: Record<string, number>,
  period: CostPeriod = 'monthly'
): Promise<GenerationResult> {
  const logs: string[] = [];
  const start = Date.now();
  const log = (msg: string) =>
    logs.push(`[${new Date().toISOString()}] ${msg}`);

  try {
    log('Starting diagram generation.');
    log('Parsing ADAC content...');
    const adac = parseAdacFromContent(inputContent, {
      validate: false,
    });
    if (validate) {
      log('Validating ADAC schema...');
      const validation = validateAdacConfig(adac);
      if (!validation.valid) {
        throw new Error(
          `Schema validation failed:\n${validation.errors?.join('\n')}`
        );
      }
      log('Schema validation passed.');
    }

    log('Parsing complete.');

    log('Building ELK Graph structure...');
    const graph = buildElkGraph(adac);
    log(`Graph built with ${graph.children?.length || 0} top-level nodes.`);

    const engine = layoutOverride || adac.layout || 'elk';
    log(`Layout engine selected: ${engine}`);

    // Run compliance checks driven entirely by per-service `compliance:` fields in the YAML.
    // Services without a `compliance:` key are silently skipped.
    log('Running per-service compliance checks from YAML declarations...');
    const checker = new ComplianceChecker();
    const { byService } = checker.checkCompliance(adac);

    // Build a per-service violation summary for the renderer tooltip
    // Shape: { [serviceId]: { frameworks: string[], violations: string[] } }
    const complianceTooltipMap: Record<
      string,
      { frameworks: string[]; violations: string[] }
    > = {};

    for (const [serviceId, results] of Object.entries(byService)) {
      const frameworks = results.map((r) => r.framework);
      const violations: string[] = [];

      for (const result of results) {
        if (!result.isCompliant) {
          log(
            `Service '${serviceId}' has ${result.violations.length} violations for framework '${result.framework}'`
          );
          for (const v of result.violations) {
            violations.push(
              `[${result.framework.toUpperCase()} - ${v.severity.toUpperCase()}] ${v.message}`
            );
          }
        } else {
          log(
            `Service '${serviceId}' complies with framework '${result.framework}'`
          );
        }
      }

      complianceTooltipMap[serviceId] = { frameworks, violations };
    }

    if (Object.keys(complianceTooltipMap).length === 0) {
      log(
        'No services with compliance declarations found — skipping compliance tooltips.'
      );
    }

    const perServiceCosts = costData;

    log('Rendering SVG (Computing Layout & Styles)...');
    const svg = await renderSvg(
      graph,
      engine,
      complianceTooltipMap,
      perServiceCosts,
      period
    );
    log('SVG Rendering complete.');

    // Removed cost summary injection

    const duration = Date.now() - start;
    log(`Total generation time: ${duration}ms`);

    return { svg, logs, duration };
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    log(`Error: ${error.message}`);
    (error as Error & { logs?: string[] }).logs = logs;
    throw error;
  }
}

export async function generateDiagram(
  input: string,
  output: string,
  layoutOverride?: 'elk' | 'dagre',
  validate: boolean = false,
  costData?: Record<string, number>,
  period: CostPeriod = 'monthly'
): Promise<void> {
  const raw = await fs.readFile(input, 'utf8');
  const { svg } = await generateDiagramSvg(
    raw,
    layoutOverride,
    validate,
    costData,
    period
  );

  await fs.outputFile(output, svg);
  console.log(`Diagram generated: ${output}`);
}
