#!/usr/bin/env node
import { Command } from 'commander';
import { generateDiagram } from '@mindfiredigital/adac-diagram';
import path from 'path';

const program = new Command();

program
  .name('adac')
  .description('ADAC - AWS Diagram Generator')
  .version('1.0.0');

program
  .command('diagram <file>')
  .description('Generate diagram from ADAC YAML file')
  .option('-l, --layout <type>', 'Layout engine (elk or dagre)', 'elk')
  .option('-o, --output <path>', 'Output SVG file path')
  .action(async (file, options) => {
    try {
      const inputPath = path.resolve(process.cwd(), file);
      const layout = options.layout as 'elk' | 'dagre';

      let outputPath = options.output;
      if (!outputPath) {
        const parsed = path.parse(inputPath);
        outputPath = path.join(parsed.dir, `${parsed.name}.svg`);
      }
      outputPath = path.resolve(process.cwd(), outputPath);

      console.log(`Generating diagram from ${inputPath}...`);
      await generateDiagram(inputPath, outputPath, layout);
    } catch (error) {
      const err = error as Error;
      console.error('Error generating diagram:', err.message);
      process.exit(1);
    }
  });

program.parse();
