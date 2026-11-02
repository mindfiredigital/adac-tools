#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { parseAdac } from '@mindfiredigital/adac-parser';
import { buildElkGraph } from './elk-builder.js';

const program = new Command();

program
  .name('adac-layout-elk')
  .description('Parse ADAC YAML and generate ELK layout graph')
  .argument('<file>', 'Path to ADAC YAML file')
  .option('-o, --output <file>', 'Output path for JSON graph')
  .option('--no-validate', 'Skip schema validation')
  .action(async (file, opts) => {
    try {
      const inputPath = path.resolve(process.cwd(), file);
      const validate = opts.validate !== false;

      console.log(`Building ELK graph from ${inputPath}...`);

      const config = parseAdac(inputPath, { validate });
      const graph = await buildElkGraph(config);

      const jsonGraph = JSON.stringify(graph, null, 2);

      if (opts.output) {
        const outFilePath = path.resolve(process.cwd(), opts.output);
        fs.writeFileSync(outFilePath, jsonGraph);
        console.log(`✅ ELK graph saved to ${outFilePath}`);
      } else {
        console.log('\n--- ELK Graph Layout JSON ---\n');
        console.log(jsonGraph);
        console.log('\n-----------------------------\n');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Error generating ELK layout:', message);
      process.exit(1);
    }
  });

program.parse(process.argv);
