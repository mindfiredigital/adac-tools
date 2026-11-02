#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { generateTerraformFromAdacFile } from './terraform-generator.js';

const program = new Command();

program
  .name('adac-export-terraform')
  .description('Export ADAC diagrams to Terraform HCL files')
  .argument('<file>', 'Path to ADAC YAML file')
  .option('-o, --output <dir>', 'Output directory for Terraform files')
  .option('--no-validate', 'Skip schema validation')
  .action(async (file, opts) => {
    try {
      const inputPath = path.resolve(process.cwd(), file);
      const validate = opts.validate !== false;

      console.log(`Generating Terraform HCL from ${inputPath}...`);

      const result = await generateTerraformFromAdacFile(inputPath, {
        validate,
      });

      if (opts.output) {
        const outputDir = path.resolve(process.cwd(), opts.output);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const parsedPath = path.parse(inputPath);
        const outFilePath = path.join(outputDir, `${parsedPath.name}.tf`);
        fs.writeFileSync(outFilePath, result.mainTf);
        console.log(`✅ Terraform HCL saved to ${outFilePath}`);
      } else {
        console.log('\n--- Terraform HCL ---\n');
        console.log(result.mainTf);
        console.log('\n---------------------\n');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Error generating Terraform HCL:', message);
      process.exit(1);
    }
  });

program.parse(process.argv);
