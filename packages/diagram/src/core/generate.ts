import fs from 'fs-extra';
import { parseAdacFromContent } from '@mindfiredigital/adac-parser';
import { buildElkGraph } from '@mindfiredigital/adac-layout-elk';
import { renderSvg } from '../renderers/svgRenderer.js';

// New function returning SVG string
export interface GenerationResult {
  svg: string;
  logs: string[];
  duration: number;
}

export async function generateDiagramSvg(
  inputContent: string,
  layoutOverride?: 'elk' | 'dagre'
): Promise<GenerationResult> {
  const logs: string[] = [];
  const start = Date.now();
  const log = (msg: string) =>
    logs.push(`[${new Date().toISOString()}] ${msg}`);

  try {
    log('Starting diagram generation.');

    // Use the new parser that accepts content string
    log('Parsing ADAC content...');
    const adac = parseAdacFromContent(inputContent);
    log('Parsing complete.');

    log('Building ELK Graph structure...');
    const graph = buildElkGraph(adac);
    log(`Graph built with ${graph.children?.length || 0} top-level nodes.`);

    // CLI override > YAML config > Default (elk)
    const engine = layoutOverride || adac.layout || 'elk';
    log(`Layout engine selected: ${engine}`);

    log('Rendering SVG (Computing Layout & Styles)...');
    const svg = await renderSvg(graph, engine);
    log('SVG Rendering complete.');

    const duration = Date.now() - start;
    log(`Total generation time: ${duration}ms`);

    return { svg, logs, duration };
  } catch (e) {
    const error = e as Error & { logs?: string[] };
    log(`Error: ${error.message}`);
    // Augment error with logs
    error.logs = logs;
    throw error;
  }
}

export async function generateDiagram(
  input: string,
  output: string,
  layoutOverride?: 'elk' | 'dagre'
): Promise<void> {
  const raw = await fs.readFile(input, 'utf8');
  const { svg } = await generateDiagramSvg(raw, layoutOverride);

  await fs.outputFile(output, svg);
  console.log(`✅ Diagram generated: ${output}`);
}
