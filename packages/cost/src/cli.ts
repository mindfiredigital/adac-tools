#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { aggregateCostFromYaml } from './aggregate-cost-from-yaml';
import type {
  CostBreakdown,
  CostPeriod,
  PricingModel,
} from './types/cost-types';

function printCostBreakdown(cost: CostBreakdown) {
  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const pct = (value: number) =>
    cost.total > 0 ? Math.round((value / cost.total) * 100) : 0;

  console.log(
    `💰 Estimated ${cost.period.charAt(0).toUpperCase() + cost.period.slice(1)} Cost: ${formatCurrency(cost.total)}`
  );
  console.log(
    `├─ Compute: ${formatCurrency(cost.compute)} (${pct(cost.compute)}%)`
  );
  console.log(
    `├─ Database: ${formatCurrency(cost.database)} (${pct(cost.database)}%)`
  );
  console.log(
    `├─ Storage: ${formatCurrency(cost.storage)} (${pct(cost.storage)}%)`
  );
  console.log(
    `└─ Networking: ${formatCurrency(cost.networking)} (${pct(cost.networking)}%)`
  );
}

const program = new Command();

program
  .name('adac-cost')
  .description('Calculate and print cost breakdown from ADAC YAML file')
  .argument('<file>', 'Path to ADAC YAML file')
  .option(
    '--pricing <model>',
    'Pricing model (on_demand or reserved)',
    'on_demand'
  )
  .option(
    '--period <period>',
    'Cost period (hourly, daily, monthly, yearly)',
    'monthly'
  )
  .action(async (file, opts) => {
    try {
      const inputPath = path.resolve(process.cwd(), file);
      const cost = aggregateCostFromYaml(
        inputPath,
        opts.period as CostPeriod,
        opts.pricing as PricingModel
      );
      printCostBreakdown(cost);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Error calculating cost:', message);
      process.exit(1);
    }
  });

program.parse(process.argv);
