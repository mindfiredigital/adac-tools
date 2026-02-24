#!/usr/bin/env node
import { Command } from 'commander';
import { generateDiagram } from './index.js'; // Updated import
import path from 'path';
import { readFileSync } from 'fs';
import { parseAdac } from '@mindfiredigital/adac-parser';
import { validateAdacConfig } from '@mindfiredigital/adac-schema';

const program = new Command();

// Read version from package.json
const pkgPath = path.resolve(__dirname, '../package.json');
let version = '0.0.1';
try {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  version = pkg.version;
} catch (e) {}

program
  .name('adac')
  .description('ADAC - AWS Diagram Generator')
  .version(version);

program
  .command('diagram <file>')
  .description('Generate diagram from ADAC YAML file')
  .option('-l, --layout <type>', 'Layout engine (elk or dagre)', 'elk')
  .option('-o, --output <path>', 'Output SVG file path')
  .option('--validate', 'Validate schema before generating')
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
      await generateDiagram(inputPath, outputPath, layout, options.validate);
      
    } catch (error: any) {
      console.error('Error generating diagram:', error.message);
      process.exit(1);
    }
  });

program
  .command('validate <file>')
  .description('Validate ADAC YAML file against schema')
  .action(async (file) => {
    try {
      const inputPath = path.resolve(process.cwd(), file);
      console.log(`Validating ${inputPath}...`);
      
      const config = parseAdac(inputPath, { validate: false });
      const result = validateAdacConfig(config);
      
      if (result.valid) {
        console.log('✅ Validation passed.');
        process.exit(0);
      } else {
        console.error('❌ Validation failed:');
        result.errors?.forEach(err => console.error(`  - ${err}`));
        process.exit(1);
      }
    } catch (error: any) {
      console.error('Error validating file:', error.message);
      process.exit(1);
    }
  });

program.parse();
