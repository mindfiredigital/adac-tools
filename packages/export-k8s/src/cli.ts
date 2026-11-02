#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import {
  generateK8sManifestsFromAdacFile,
  renderK8sYaml,
} from './k8s-generator.js';

const program = new Command();

program
  .name('adac-export-k8s')
  .description('Export ADAC diagrams to Kubernetes manifests')
  .argument('<file>', 'Path to ADAC YAML file')
  .option('-o, --output <dir>', 'Output directory for Kubernetes manifests')
  .option('-n, --namespace <ns>', 'Kubernetes namespace', 'default')
  .option('--no-validate', 'Skip schema validation')
  .action((file, opts) => {
    try {
      const inputPath = path.resolve(process.cwd(), file);
      const validate = opts.validate !== false;

      console.log(`Generating Kubernetes manifests from ${inputPath}...`);

      const result = generateK8sManifestsFromAdacFile(inputPath, {
        validate,
        namespace: opts.namespace,
      });

      const yamlContent = renderK8sYaml(result.manifests);

      if (opts.output) {
        const outputDir = path.resolve(process.cwd(), opts.output);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const parsedPath = path.parse(inputPath);
        const outFilePath = path.join(outputDir, `${parsedPath.name}.k8s.yaml`);
        fs.writeFileSync(outFilePath, yamlContent);
        console.log(`✅ Kubernetes manifests saved to ${outFilePath}`);
      } else {
        console.log('\n--- Kubernetes Manifests ---\n');
        console.log(yamlContent);
        console.log('\n----------------------------\n');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Error generating Kubernetes manifests:', message);
      process.exit(1);
    }
  });

program.parse(process.argv);
