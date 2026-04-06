import fs from 'fs-extra';
import {
  parseAdacFromContent,
  type AdacConfigWithCosts,
} from '@mindfiredigital/adac-parser';
import { buildElkGraph } from '@mindfiredigital/adac-layout-elk';
import { validateAdacConfig } from '@mindfiredigital/adac-schema';
import { ComplianceChecker } from '@mindfiredigital/adac-compliance';
import { CostCalculator, type CostConfig } from '@mindfiredigital/adac-cost';
import { renderSvg } from './renderer.js';

type PricingModel = 'on_demand' | 'reserved';
type CostPeriod = 'hourly' | 'daily' | 'monthly' | 'yearly';

type ComplianceSummary = {
  framework: string;
  isCompliant: boolean;
  violations: Array<{
    severity: string;
    message: string;
  }>;
};

function getNumber(
  config: Record<string, unknown> | undefined,
  key: string,
  fallback: number
): number {
  const value = config?.[key];
  return typeof value === 'number' ? value : fallback;
}

function getString(
  config: Record<string, unknown> | undefined,
  key: string,
  fallback: string
): string {
  const value = config?.[key];
  return typeof value === 'string' ? value : fallback;
}

function buildPerServiceCosts(
  adac: AdacConfigWithCosts,
  pricingModel: PricingModel,
  period: CostPeriod
): Record<string, number> | undefined {
  const services = adac.infrastructure?.clouds?.[0]?.services ?? [];

  if (services.length === 0) {
    return undefined;
  }

  const costConfig: CostConfig = {
    compute: [],
    database: [],
    storage: [],
    networking: [],
  };

  for (const svc of services) {
    const config = svc.config;

    if (svc.type === 'compute') {
      if (svc.subtype === 'ecs-fargate') {
        costConfig.compute?.push({
          type: 'ecs',
          vcpu: getNumber(config, 'vcpu', 0.25),
          memoryGB: getNumber(config, 'memory_gb', 0.5),
          count: getNumber(config, 'count', 1),
          pricingModel,
        });
      } else {
        costConfig.compute?.push({
          type: 'ec2',
          instanceType: getString(config, 'instance_class', 't3.micro'),
          count: getNumber(config, 'count', 1),
          pricingModel,
        });
      }
    } else if (svc.type === 'database') {
      costConfig.database?.push({
        type: 'rds',
        instanceType: getString(config, 'instance_class', 'db.t3.micro'),
        count: getNumber(config, 'count', 1),
        pricingModel,
      });
    } else if (svc.type === 'storage') {
      costConfig.storage?.push({
        type: 's3',
        tier: 'standard',
        storageGB: getNumber(config, 'size_gb', 100),
        pricingModel,
      });
    } else if (
      svc.type === 'network' &&
      svc.subtype !== 'subnet' &&
      svc.subtype !== 'vpc'
    ) {
      costConfig.networking?.push({
        type: 'data_transfer',
        transferGB: getNumber(config, 'transfer_gb', 50),
        pricingModel,
      });
    }
  }

  const breakdown = new CostCalculator().calculate(costConfig, period);
  const perService: Record<string, number> = {};

  const computeCount = services.filter((s) => s.type === 'compute').length;
  const databaseCount = services.filter((s) => s.type === 'database').length;
  const storageCount = services.filter((s) => s.type === 'storage').length;
  const networkCount = services.filter(
    (s) => s.type === 'network' && s.subtype !== 'subnet' && s.subtype !== 'vpc'
  ).length;

  for (const svc of services) {
    if (!svc.id || svc.subtype === 'subnet' || svc.subtype === 'vpc') {
      continue;
    }

    if (svc.type === 'compute' && computeCount > 0) {
      perService[svc.id] = breakdown.compute / computeCount;
    } else if (svc.type === 'database' && databaseCount > 0) {
      perService[svc.id] = breakdown.database / databaseCount;
    } else if (svc.type === 'storage' && storageCount > 0) {
      perService[svc.id] = breakdown.storage / storageCount;
    } else if (svc.type === 'network' && networkCount > 0) {
      perService[svc.id] = breakdown.networking / networkCount;
    }
  }

  return Object.keys(perService).length > 0 ? perService : undefined;
}

export interface GenerationResult {
  svg: string;
  logs: string[];
  duration: number;
}

export async function generateDiagramSvg(
  inputContent: string,
  layoutOverride?: 'elk' | 'dagre',
  validate: boolean = false,
  includeCost: boolean = false,
  pricingModel: PricingModel = 'on_demand',
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

    const perServiceCosts = includeCost
      ? buildPerServiceCosts(adac, pricingModel, period)
      : (adac.costs?.perService as Record<string, number> | undefined);

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
  includeCost: boolean = false,
  pricingModel: 'on_demand' | 'reserved' = 'on_demand',
  period: 'hourly' | 'daily' | 'monthly' | 'yearly' = 'monthly'
): Promise<void> {
  const raw = await fs.readFile(input, 'utf8');
  const { svg } = await generateDiagramSvg(
    raw,
    layoutOverride,
    validate,
    includeCost,
    pricingModel,
    period
  );

  await fs.outputFile(output, svg);
  console.log(`Diagram generated: ${output}`);
}
