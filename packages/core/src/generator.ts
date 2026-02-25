import fs from 'fs-extra';
import { parseAdacFromContent } from '@mindfiredigital/adac-parser';
import { buildElkGraph } from '@mindfiredigital/adac-layout-elk';
import { validateAdacConfig } from '@mindfiredigital/adac-schema';
import { renderSvg } from './renderer.js';

export interface GenerationResult {
  svg: string;
  logs: string[];
  duration: number;
}

export async function generateDiagramSvg(
  inputContent: string,
  layoutOverride?: 'elk' | 'dagre',
  validate: boolean = false
): Promise<GenerationResult> {
  const logs: string[] = [];
  const start = Date.now();
  const log = (msg: string) =>
    logs.push(`[${new Date().toISOString()}] ${msg}`);

  try {
    log('Starting diagram generation.');
    log('Parsing ADAC content...');
    const adac = parseAdacFromContent(inputContent);

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

    log('Rendering SVG (Computing Layout & Styles)...');
    const svg = await renderSvg(graph, engine);
    log('SVG Rendering complete.');

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
  validate: boolean = false
): Promise<void> {
  const raw = await fs.readFile(input, 'utf8');
  const { svg } = await generateDiagramSvg(raw, layoutOverride, validate);

  await fs.outputFile(output, svg);
  console.log(`✅ Diagram generated: ${output}`);
}
