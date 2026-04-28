import { Command } from 'commander';
import path from 'path';
import { exec } from 'child_process';

export type CostPeriod = 'hourly' | 'daily' | 'monthly' | 'yearly';
export type PricingModel = 'on_demand' | 'reserved';

export type CostBreakdown = {
  compute: number;
  database: number;
  storage: number;
  networking: number;
  total: number;
  period: CostPeriod;
};

export type CLIOptions = {
  generateDiagram: (
    input: string,
    output: string,
    layoutOverride?: 'elk' | 'dagre',
    validate?: boolean,
    costData?: Record<string, number>,
    period?: CostPeriod,
    pricingModel?: PricingModel,
    skipOptimizer?: boolean
  ) => Promise<void>;
  calculateCostFromYaml?: (
    input: string,
    period?: CostPeriod,
    pricingModel?: PricingModel
  ) => CostBreakdown;
  generateTerraformFromYaml?: (
    input: string,
    outputDir?: string,
    validate?: boolean
  ) => Promise<void>;
  parseAdac: (input: string, options?: Record<string, unknown>) => unknown;
  validateAdacConfig: (config: unknown) => {
    valid: boolean;
    errors?: string[];
  };
  version: string;
};

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

/**
 * Initializes and runs the ADAC CLI with diagram generation, cost calculation, and validation commands.
 * @param options - Configuration object providing core functionality (diagram generation, parsing, validation) and version info
 */
export function runCLI(options: CLIOptions) {
  const program = new Command();

  program
    .name('adac')
    .description('ADAC - AWS Diagram Generator')
    .version(options.version);

  program
    .command('diagram <file>')
    .description('Generate diagram from ADAC YAML file')
    .option('-l, --layout <type>', 'Layout engine (elk or dagre)', 'elk')
    .option('-o, --output <path>', 'Output SVG file path')
    .option('--validate', 'Validate schema before generating')
    .option('--cost', 'Print cost breakdown and generate diagram')
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
    .option('--no-optimize', 'Skip architecture optimization analysis')

    .action(async (file, opts) => {
      try {
        const inputPath = path.resolve(process.cwd(), file);

        if (opts.cost) {
          try {
            if (!options.calculateCostFromYaml) {
              throw new Error(
                'Cost calculation is not available in this CLI build.'
              );
            }
            const cost = options.calculateCostFromYaml(
              inputPath,
              opts.period,
              opts.pricing as PricingModel
            );
            printCostBreakdown(cost);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('Error calculating cost:', msg);
          }
        }

        const layout = opts.layout as 'elk' | 'dagre';
        // Commander turns --no-optimize into opts.optimize = false
        const skipOptimizer = opts.optimize === false;

        let outputPath: string = opts.output;
        if (!outputPath) {
          const parsed = path.parse(inputPath);
          outputPath = path.join(parsed.dir, `${parsed.name}.svg`);
        }
        outputPath = path.resolve(process.cwd(), outputPath);

        console.log(`Generating diagram from ${inputPath}...`);
        await options.generateDiagram(
          inputPath,
          outputPath,
          layout,
          Boolean(opts.validate),
          undefined,
          opts.period as CostPeriod,
          opts.pricing as PricingModel,
          skipOptimizer
        );

        console.log(`Diagram successfully generated at ${outputPath}`);
        console.log('Automatically launching browser to view diagram...');

        let startCmd = '';
        if (process.platform === 'darwin') {
          startCmd = `open "${outputPath}"`;
        } else if (process.platform === 'win32') {
          startCmd = `start "" "${outputPath}"`;
        } else {
          startCmd = `xdg-open "${outputPath}"`;
        }

        exec(startCmd, (err) => {
          if (err) {
            console.error('Failed to launch browser:', err.message);
          }
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error generating diagram:', message);
        process.exit(1);
      }
    });

  program
    .command('cost <file>')
    .description('Calculate and print cost breakdown from ADAC YAML file')
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
        if (!options.calculateCostFromYaml) {
          throw new Error(
            'Cost calculation is not available in this CLI build.'
          );
        }

        const cost = options.calculateCostFromYaml(
          inputPath,
          opts.period,
          opts.pricing as PricingModel
        );
        printCostBreakdown(cost);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error calculating cost:', message);
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

        const config = options.parseAdac(inputPath, { validate: false });
        const result = options.validateAdacConfig(config);

        if (result.valid) {
          console.log('✅ Validation passed.');
          process.exit(0);
        } else {
          console.error('❌ Validation failed:');
          result.errors?.forEach((err) => console.error(`  - ${err}`));
          process.exit(1);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error validating file:', message);
        process.exit(1);
      }
    });

  program
    .command('terraform <file>')
    .description('Generate Terraform files from ADAC YAML file')
    .option('-o, --output <dir>', 'Output directory for Terraform files')
    .option('--validate', 'Validate schema before generating')
    .action(async (file, opts) => {
      try {
        const inputPath = path.resolve(process.cwd(), file);
        const outputDir = opts.output
          ? path.resolve(process.cwd(), opts.output)
          : undefined;

        if (!options.generateTerraformFromYaml) {
          throw new Error(
            'Terraform generation is not available in this CLI build.'
          );
        }

        console.log(`Generating Terraform from ${inputPath}...`);
        await options.generateTerraformFromYaml(
          inputPath,
          outputDir,
          opts.validate
        );
        console.log(
          `Terraform successfully generated${outputDir ? ` in ${outputDir}` : '.'}`
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error generating Terraform:', message);
        process.exit(1);
      }
    });

  program.parse(process.argv);
}
