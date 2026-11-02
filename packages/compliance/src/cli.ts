#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { parseAdac } from '@mindfiredigital/adac-parser';
import { ComplianceChecker } from './compliance-checker';

const program = new Command();

program
  .name('adac-compliance')
  .description('Validate ADAC architecture compliance')
  .argument('<file>', 'Path to ADAC YAML file')
  .action((file) => {
    try {
      const inputPath = path.resolve(process.cwd(), file);
      console.log(`Checking compliance for ${inputPath}...`);

      const config = parseAdac(inputPath, { validate: true });
      const checker = new ComplianceChecker();
      const { results, remediationPlan } = checker.checkCompliance(config);

      const failed = results.filter((r) => !r.isCompliant);

      if (failed.length === 0) {
        console.log('✅ All compliance checks passed!');
        process.exit(0);
      } else {
        const totalViolations = failed.reduce(
          (sum, f) => sum + f.violations.length,
          0
        );
        console.error(`❌ Found ${totalViolations} compliance violations:`);
        failed.forEach((f) => {
          f.violations.forEach((v) => {
            console.error(
              `  - [${f.framework}] ${v.id} (${v.severity}): ${v.message}`
            );
          });
        });

        if (remediationPlan.length > 0) {
          console.log('\n💡 Remediation Plan:');
          remediationPlan.forEach((plan) => {
            console.log(
              `  For resource ${plan.resourceId} (${plan.frameworks.join(', ')}):`
            );
            plan.steps.forEach((step) => console.log(`    - ${step}`));
          });
        }
        process.exit(1);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Error checking compliance:', message);
      process.exit(1);
    }
  });

program.parse(process.argv);
