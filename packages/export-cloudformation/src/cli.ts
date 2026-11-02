#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { generateCloudFormationFromAdacFile } from './cfn-generator.js';

const program = new Command();

program
  .name('adac-export-cloudformation')
  .description('Export ADAC diagrams to AWS CloudFormation templates')
  .argument('<file>', 'Path to ADAC YAML file')
  .option('-o, --output <dir>', 'Output directory for CloudFormation templates')
  .option('--no-validate', 'Skip schema validation')
  .action((file, opts) => {
    try {
      const inputPath = path.resolve(process.cwd(), file);
      const validate = opts.validate !== false;

      console.log(`Generating CloudFormation from ${inputPath}...`);

      const result = generateCloudFormationFromAdacFile(inputPath, {
        validate,
      });

      if (opts.output) {
        const outputDir = path.resolve(process.cwd(), opts.output);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const parsedPath = path.parse(inputPath);
        const outFilePath = path.join(outputDir, `${parsedPath.name}.cfn.yaml`);
        fs.writeFileSync(outFilePath, result.templateYaml);
        console.log(`✅ CloudFormation template saved to ${outFilePath}`);
      } else {
        console.log('\n--- CloudFormation Template ---\n');
        console.log(result.templateYaml);
        console.log('\n-------------------------------\n');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Error generating CloudFormation:', message);
      process.exit(1);
    }
  });

program.parse(process.argv);
