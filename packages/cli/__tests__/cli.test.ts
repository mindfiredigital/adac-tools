import { Command } from 'commander';
import * as diagram from '@mindfiredigital/adac-diagram';

jest.mock('@mindfiredigital/adac-diagram');

const mockDiagram = diagram as jest.Mocked<typeof diagram>;

describe('CLI', () => {
  let program: Command;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    program = new Command();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(((
      code?: string | number | null | undefined
    ) => {
      throw new Error(`Process.exit called with ${code}`);
    }) as never);

    // Mock successful diagram generation by default
    mockDiagram.generateDiagram.mockResolvedValue();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should have correct program name and description', () => {
    program
      .name('adac-diagram')
      .description('Generate architecture diagrams from ADAC YAML files')
      .version('1.0.0');

    expect(program.name()).toBe('adac-diagram');
  });

  it('should accept input and output options', () => {
    program
      .option('-i, --input <path>', 'Input ADAC YAML file')
      .option('-o, --output <path>', 'Output SVG file path');

    const options = program.opts();
    expect(program.options.some((opt) => opt.short === '-i')).toBe(true);
    expect(program.options.some((opt) => opt.short === '-o')).toBe(true);
  });

  it('should accept layout option', () => {
    program.option(
      '-l, --layout <engine>',
      'Layout engine (elk or dagre)',
      'elk'
    );

    expect(program.options.some((opt) => opt.short === '-l')).toBe(true);
  });

  it('should handle generate command with all options', async () => {
    const handler = async (options: {
      input?: string;
      output?: string;
      layout?: 'elk' | 'dagre';
    }) => {
      const inputPath = options.input || 'input.yaml';
      const outputPath = options.output || 'output.svg';
      const layout = options.layout || 'elk';

      await mockDiagram.generateDiagram(inputPath, outputPath, layout);
    };

    await handler({
      input: 'test.yaml',
      output: 'test.svg',
      layout: 'elk',
    });

    expect(mockDiagram.generateDiagram).toHaveBeenCalledWith(
      'test.yaml',
      'test.svg',
      'elk'
    );
  });

  it('should use default output path if not provided', async () => {
    const handler = async (options: {
      input?: string;
      output?: string;
      layout?: 'elk' | 'dagre';
    }) => {
      const inputPath = options.input || 'input.yaml';
      let outputPath = options.output;

      if (!outputPath && inputPath) {
        const path = await import('path');
        const parsed = path.parse(inputPath);
        outputPath = path.join(parsed.dir, `${parsed.name}.svg`);
      }

      await mockDiagram.generateDiagram(
        inputPath,
        outputPath || 'output.svg',
        options.layout
      );
    };

    await handler({ input: 'diagrams/test.yaml' });

    expect(mockDiagram.generateDiagram).toHaveBeenCalledWith(
      'diagrams/test.yaml',
      expect.stringContaining('test.svg'),
      undefined
    );
  });

  it('should use dagre layout when specified', async () => {
    const handler = async (options: {
      input?: string;
      output?: string;
      layout?: 'elk' | 'dagre';
    }) => {
      const inputPath = options.input || 'input.yaml';
      const outputPath = options.output || 'output.svg';

      await mockDiagram.generateDiagram(inputPath, outputPath, options.layout);
    };

    await handler({
      input: 'test.yaml',
      output: 'test.svg',
      layout: 'dagre',
    });

    expect(mockDiagram.generateDiagram).toHaveBeenCalledWith(
      'test.yaml',
      'test.svg',
      'dagre'
    );
  });

  it('should handle generation errors', async () => {
    mockDiagram.generateDiagram.mockRejectedValue(
      new Error('Generation failed')
    );

    const handler = async (options: {
      input?: string;
      output?: string;
      layout?: 'elk' | 'dagre';
    }) => {
      try {
        await mockDiagram.generateDiagram(
          options.input || 'input.yaml',
          options.output || 'output.svg',
          options.layout
        );
      } catch (error) {
        const err = error as Error;
        console.error('Error generating diagram:', err.message);
        process.exit(1);
      }
    };

    await expect(
      handler({ input: 'test.yaml', output: 'test.svg' })
    ).rejects.toThrow('Process.exit called with 1');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error generating diagram:',
      'Generation failed'
    );
  });

  it('should log generation start message', async () => {
    const handler = async (options: {
      input?: string;
      output?: string;
      layout?: 'elk' | 'dagre';
    }) => {
      const inputPath = options.input || 'input.yaml';
      console.log(`Generating diagram from ${inputPath}...`);
      await mockDiagram.generateDiagram(
        inputPath,
        options.output || 'output.svg',
        options.layout
      );
    };

    await handler({ input: 'test.yaml' });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Generating diagram from test.yaml...'
    );
  });

  it('should resolve output path relative to cwd', async () => {
    const path = await import('path');
    const handler = async (options: {
      input?: string;
      output?: string;
      layout?: 'elk' | 'dagre';
    }) => {
      const inputPath = options.input || 'input.yaml';
      let outputPath = options.output;

      if (!outputPath && inputPath) {
        const parsed = path.parse(inputPath);
        outputPath = path.join(parsed.dir, `${parsed.name}.svg`);
      }

      outputPath = path.resolve(process.cwd(), outputPath!);

      await mockDiagram.generateDiagram(inputPath, outputPath, options.layout);
    };

    await handler({ input: 'test.yaml' });

    expect(mockDiagram.generateDiagram).toHaveBeenCalledWith(
      'test.yaml',
      expect.stringContaining(process.cwd()),
      undefined
    );
  });
});
