#!/usr/bin/env node
import { runCLI } from '@mindfiredigital/adac-cli';
import {
  generateDiagram,
  parseAdac,
  validateAdacConfig,
} from '@mindfiredigital/adac-core';
import { aggregateCostFromYaml } from '@mindfiredigital/adac-cost';
import path from 'path';
import { readFileSync } from 'fs';
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
  generateDiagram,
  calculateCostFromYaml: aggregateCostFromYaml,
  parseAdac,
  validateAdacConfig,
  version,
});
