import { Command } from 'commander';
import path from 'path';

export interface CLIOptions {
  generateDiagram: (
    input: string,
    output: string,
    layoutOverride?: 'elk' | 'dagre',
    validate?: boolean
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
    .action(async (file, opts) => {
      try {
        const inputPath = path.resolve(process.cwd(), file);
        const layout = opts.layout as 'elk' | 'dagre';

        let outputPath = opts.output;
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
          opts.validate
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
