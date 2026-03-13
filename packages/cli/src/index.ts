import { Command } from 'commander';
import path from 'path';
import { aggregateCostFromYaml } from '@mindfiredigital/adac-cost';

export interface CLIOptions {
  generateDiagram: (
    input: string,
    output: string,
    layoutOverride?: 'elk' | 'dagre',
    validate?: boolean,
    includeCost?: boolean,
    pricingModel?: 'on_demand' | 'reserved',
    period?: 'hourly' | 'daily' | 'monthly' | 'yearly'
  ) => Promise<void>;
  parseAdac: (input: string, options?: Record<string, unknown>) => unknown;
  validateAdacConfig: (config: unknown) => {
    valid: boolean;
    errors?: string[];
  };
  version: string;
}

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

    .action(async (file, opts) => {
      try {
        const inputPath = path.resolve(process.cwd(), file);

        if (opts.cost) {
          try {
            aggregateCostFromYaml(inputPath);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('Error calculating cost:', msg);
          }
        }

        const layout = opts.layout as 'elk' | 'dagre';

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
          Boolean(opts.cost),
          opts.pricing,
          opts.period
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error generating diagram:', message);
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

  program.parse(process.argv);
}
