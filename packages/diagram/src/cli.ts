#!/usr/bin/env node
import { runCLI } from '@mindfiredigital/adac-cli';
import {
  generateDiagram,
  parseAdac,
  validateAdacConfig,
} from '@mindfiredigital/adac-core';
import {
  aggregateCostFromYaml,
  calculatePerServiceCosts,
} from '@mindfiredigital/adac-cost';
import { generateTerraformFromAdacFile } from '@mindfiredigital/adac-export-terraform';
import type { CostPeriod } from '@mindfiredigital/adac-cost';
import path from 'path';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { PricingModel } from '@mindfiredigital/adac-cost';

// Read version from package.json
// tsup shims __dirname for both CJS and ESM
const pkgPath = path.resolve(__dirname, '../package.json');
let version = '0.1.0';
try {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  version = pkg.version;
} catch {
  // Fallback to default version if package.json cannot be read
}

runCLI({
  generateDiagram: async (
    input: string,
    output: string,
    layoutOverride?: 'elk' | 'dagre',
    validate?: boolean,
    _costData?: Record<string, number>,
    period?: string,
    pricingModel?: PricingModel,
    skipOptimizer?: boolean
  ) => {
    const adacConfig = parseAdac(input, { validate: false });
    const perServiceCosts = calculatePerServiceCosts(
      adacConfig,
      period as CostPeriod,
      pricingModel ?? 'on_demand'
    );
    return generateDiagram(
      input,
      output,
      layoutOverride,
      validate,
      perServiceCosts,
      period as CostPeriod,
      skipOptimizer ?? false
    );
  },
  calculateCostFromYaml: aggregateCostFromYaml,
  generateTerraformFromYaml: async (
    input: string,
    outputDir?: string,
    validate?: boolean
  ) => {
    const result = generateTerraformFromAdacFile(input, {
      validate: validate ?? true,
    });

    const parsed = path.parse(input);
    const targetDir =
      outputDir ?? path.resolve(parsed.dir, `${parsed.name}-terraform`);

    mkdirSync(targetDir, { recursive: true });
    writeFileSync(path.join(targetDir, 'main.tf'), result.mainTf);
    writeFileSync(path.join(targetDir, 'variables.tf'), result.variablesTf);
    writeFileSync(path.join(targetDir, 'outputs.tf'), result.outputsTf);

    console.log(`Terraform files written to ${targetDir}`);
  },
  parseAdac,
  validateAdacConfig,
  version,
});
