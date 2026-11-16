import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { exec } from 'child_process';

/**
 * Time period used to present estimated infrastructure cost.
 */
export type CostPeriod = 'hourly' | 'daily' | 'monthly' | 'yearly';

/**
 * Pricing strategy used when estimating infrastructure cost.
 */
export type PricingModel = 'on_demand' | 'reserved';

/**
 * Layout engine supported by the diagram generation command.
 */
export type DiagramLayoutEngine = 'elk' | 'custom' | 'orthogonal' | 'tsm';

/**
 * Aggregated infrastructure cost grouped by service category.
 */
export type CostBreakdown = {
  /** Cost attributed to compute services. */
  compute: number;
  /** Cost attributed to database services. */
  database: number;
  /** Cost attributed to storage services. */
  storage: number;
  /** Cost attributed to networking services. */
  networking: number;
  /** Total cost across all service categories. */
  total: number;
  /** Period represented by the cost values. */
  period: CostPeriod;
};

/**
 * Runtime dependencies injected into the CLI command layer.
 */
export type CLIOptions = {
  /**
   * Generates a diagram from an ADAC file.
   */
  generateDiagram: (
    input: string,
    output: string,
    layoutOverride?: DiagramLayoutEngine,
    validate?: boolean,
    costData?: Record<string, number>,
    period?: CostPeriod,
    pricingModel?: PricingModel,
    skipOptimizer?: boolean
  ) => Promise<void>;
  /**
   * Calculates a categorized cost estimate from an ADAC file.
   */
  calculateCostFromYaml?: (
    input: string,
    period?: CostPeriod,
    pricingModel?: PricingModel
  ) => CostBreakdown;
  /**
   * Generates Terraform files from an ADAC file.
   */
  generateTerraformFromYaml?: (
    input: string,
    outputDir?: string,
    validate?: boolean
  ) => Promise<void>;
  /**
   * Parses an ADAC file or content string into a configuration object.
   */
  parseAdac: (input: string, options?: Record<string, unknown>) => unknown;
  /**
   * Validates parsed ADAC configuration for cost-related schema support.
   */
  validateAdacCostConfig: (config: unknown) => {
    valid: boolean;
    errors?: string[];
  };
  /** CLI version string displayed by Commander. */
  version: string;
};

/**
 * Prints a formatted cost summary with category percentages.
 * @param cost - Categorized cost estimate to display
 */
function printCostBreakdown(cost: CostBreakdown) {
  /**
   * Formats a numeric cost value as USD.
   */
  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  /**
   * Calculates the whole-number share of the total cost for a category.
   */
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
    .option(
      '-l, --layout <type>',
      'Layout engine (elk, custom, orthogonal, or tsm); defaults to layoutOptions.engine, then elk'
    )
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
    .option('--no-open', 'Skip opening the diagram in browser')

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

        const layout = normalizeLayoutEngine(opts.layout);
        // Commander turns --no-optimize into opts.optimize = false
        const skipOptimizer = opts.optimize === false;
        const skipOpen = opts.open === false;

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

        if (!skipOpen) {
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
        }
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
        const result = options.validateAdacCostConfig(config);

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

/**
 * Validates and narrows a layout option value to a supported layout engine.
 * @param value - Raw layout value provided by Commander
 * @returns A supported layout engine, or undefined when no override was provided
 */
function normalizeLayoutEngine(
  value?: string
): DiagramLayoutEngine | undefined {
  if (value === undefined) return undefined;
  if (
    value === 'elk' ||
    value === 'custom' ||
    value === 'orthogonal' ||
    value === 'tsm'
  ) {
    return value;
  }

  throw new Error(
    chalk.red(
      `Unsupported layout engine "${value}". Expected elk, custom, orthogonal, or tsm.`
    )
  );
}
