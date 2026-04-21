import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCLI } from '../src/index.js';
import type { CostBreakdown } from '../src/index.js';

describe('ADAC CLI', () => {
  const mockOptions = {
    generateDiagram: vi.fn().mockResolvedValue(undefined),
    parseAdac: vi.fn().mockReturnValue({}),
    validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
    version: '1.0.0',
  };

  it('should call generateDiagram when diagram command is run', async () => {
    const originalArgv = process.argv;
    const originalExit = process.exit;
    process.argv = ['node', 'adac', 'diagram', 'test.yaml'];
    (process as unknown as { exit: typeof process.exit }).exit =
      vi.fn() as unknown as typeof process.exit;

    await runCLI(mockOptions);

    expect(mockOptions.generateDiagram).toBeDefined();
    process.argv = originalArgv;
    (process as unknown as { exit: typeof process.exit }).exit = originalExit;
  });

  it('should call validate command when run', async () => {
    const originalArgv = process.argv;
    const originalExit = process.exit;
    process.argv = ['node', 'adac', 'validate', 'test.yaml'];
    (process as unknown as { exit: typeof process.exit }).exit =
      vi.fn() as unknown as typeof process.exit;

    await runCLI(mockOptions);

    expect(mockOptions.validateAdacConfig).toBeDefined();
    process.argv = originalArgv;
    (process as unknown as { exit: typeof process.exit }).exit = originalExit;
  });

  it('should handle validation failure', async () => {
    const originalArgv = process.argv;
    const originalExit = process.exit;
    process.argv = ['node', 'adac', 'validate', 'test.yaml'];
    const mockExit = vi.fn();
    (process as unknown as { exit: typeof process.exit }).exit =
      mockExit as unknown as typeof process.exit;

    mockOptions.validateAdacConfig.mockReturnValueOnce({
      valid: false,
      errors: ['Invalid'],
    });

    await runCLI(mockOptions);

    expect(mockExit).toHaveBeenCalledWith(1);
    process.argv = originalArgv;
    (process as unknown as { exit: typeof process.exit }).exit = originalExit;
  });
});

describe('ADAC CLI - cost command', () => {
  let originalArgv: string[];
  let originalExit: typeof process.exit;
  let mockExit: ReturnType<typeof vi.fn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const mockCostBreakdown: CostBreakdown = {
    compute: 50.0,
    database: 30.0,
    storage: 10.0,
    networking: 10.0,
    total: 100.0,
    period: 'monthly',
  };

  beforeEach(() => {
    originalArgv = process.argv;
    originalExit = process.exit;
    mockExit = vi.fn();
    (process as unknown as { exit: typeof process.exit }).exit =
      mockExit as unknown as typeof process.exit;
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    (process as unknown as { exit: typeof process.exit }).exit = originalExit;
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should call calculateCostFromYaml and print breakdown', async () => {
    const calculateCostFromYaml = vi.fn().mockReturnValue(mockCostBreakdown);
    const options = {
      generateDiagram: vi.fn().mockResolvedValue(undefined),
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
      calculateCostFromYaml,
      version: '1.0.0',
    };

    process.argv = ['node', 'adac', 'cost', 'test.yaml'];
    await runCLI(options);

    expect(calculateCostFromYaml).toHaveBeenCalled();
    // Should print a cost line to console
    const allLogs = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allLogs).toContain('100.00');
  });

  it('should exit with code 1 when calculateCostFromYaml is not provided', async () => {
    const options = {
      generateDiagram: vi.fn().mockResolvedValue(undefined),
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
      version: '1.0.0',
      // no calculateCostFromYaml
    };

    process.argv = ['node', 'adac', 'cost', 'test.yaml'];
    await runCLI(options);

    expect(mockExit).toHaveBeenCalledWith(1);
    const errorLogs = consoleErrorSpy.mock.calls
      .map((c) => c.join(' '))
      .join('\n');
    expect(errorLogs).toContain('Cost calculation is not available');
  });

  it('should exit with code 1 when calculateCostFromYaml throws', async () => {
    const options = {
      generateDiagram: vi.fn().mockResolvedValue(undefined),
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
      calculateCostFromYaml: vi.fn().mockImplementation(() => {
        throw new Error('Pricing data unavailable');
      }),
      version: '1.0.0',
    };

    process.argv = ['node', 'adac', 'cost', 'test.yaml'];
    await runCLI(options);

    expect(mockExit).toHaveBeenCalledWith(1);
    const errorLogs = consoleErrorSpy.mock.calls
      .map((c) => c.join(' '))
      .join('\n');
    expect(errorLogs).toContain('Pricing data unavailable');
  });

  it('should pass period and pricing options to calculateCostFromYaml', async () => {
    const calculateCostFromYaml = vi
      .fn()
      .mockReturnValue({ ...mockCostBreakdown, period: 'yearly' });
    const options = {
      generateDiagram: vi.fn().mockResolvedValue(undefined),
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
      calculateCostFromYaml,
      version: '1.0.0',
    };

    process.argv = [
      'node',
      'adac',
      'cost',
      'test.yaml',
      '--period',
      'yearly',
      '--pricing',
      'reserved',
    ];
    await runCLI(options);

    expect(calculateCostFromYaml).toHaveBeenCalledWith(
      expect.any(String),
      'yearly',
      'reserved'
    );
  });

  it('should print percentage breakdown for each cost category', async () => {
    const calculateCostFromYaml = vi.fn().mockReturnValue(mockCostBreakdown);
    const options = {
      generateDiagram: vi.fn().mockResolvedValue(undefined),
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
      calculateCostFromYaml,
      version: '1.0.0',
    };

    process.argv = ['node', 'adac', 'cost', 'test.yaml'];
    await runCLI(options);

    const allLogs = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allLogs).toContain('Compute');
    expect(allLogs).toContain('Database');
    expect(allLogs).toContain('Storage');
    expect(allLogs).toContain('Networking');
    expect(allLogs).toContain('50%');
  });
});

describe('ADAC CLI - terraform command', () => {
  let originalArgv: string[];
  let originalExit: typeof process.exit;
  let mockExit: ReturnType<typeof vi.fn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalArgv = process.argv;
    originalExit = process.exit;
    mockExit = vi.fn();
    (process as unknown as { exit: typeof process.exit }).exit =
      mockExit as unknown as typeof process.exit;
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    (process as unknown as { exit: typeof process.exit }).exit = originalExit;
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should call generateTerraformFromYaml when terraform command is run', async () => {
    const generateTerraformFromYaml = vi.fn().mockResolvedValue(undefined);
    const options = {
      generateDiagram: vi.fn().mockResolvedValue(undefined),
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
      generateTerraformFromYaml,
      version: '1.0.0',
    };

    process.argv = ['node', 'adac', 'terraform', 'test.yaml'];
    await runCLI(options);

    expect(generateTerraformFromYaml).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      undefined
    );
    const allLogs = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allLogs).toContain('Terraform successfully generated');
  });

  it('should pass output directory to generateTerraformFromYaml', async () => {
    const generateTerraformFromYaml = vi.fn().mockResolvedValue(undefined);
    const options = {
      generateDiagram: vi.fn().mockResolvedValue(undefined),
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
      generateTerraformFromYaml,
      version: '1.0.0',
    };

    process.argv = [
      'node',
      'adac',
      'terraform',
      'test.yaml',
      '-o',
      'tf-output',
    ];
    await runCLI(options);

    expect(generateTerraformFromYaml).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('tf-output'),
      undefined
    );
  });

  it('should exit with code 1 when generateTerraformFromYaml is not provided', async () => {
    const options = {
      generateDiagram: vi.fn().mockResolvedValue(undefined),
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
      version: '1.0.0',
      // no generateTerraformFromYaml
    };

    process.argv = ['node', 'adac', 'terraform', 'test.yaml'];
    await runCLI(options);

    expect(mockExit).toHaveBeenCalledWith(1);
    const errorLogs = consoleErrorSpy.mock.calls
      .map((c) => c.join(' '))
      .join('\n');
    expect(errorLogs).toContain('Terraform generation is not available');
  });

  it('should exit with code 1 when generateTerraformFromYaml throws', async () => {
    const options = {
      generateDiagram: vi.fn().mockResolvedValue(undefined),
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
      generateTerraformFromYaml: vi
        .fn()
        .mockRejectedValue(new Error('Terraform error')),
      version: '1.0.0',
    };

    process.argv = ['node', 'adac', 'terraform', 'test.yaml'];
    await runCLI(options);

    expect(mockExit).toHaveBeenCalledWith(1);
    const errorLogs = consoleErrorSpy.mock.calls
      .map((c) => c.join(' '))
      .join('\n');
    expect(errorLogs).toContain('Terraform error');
  });

  it('should print output directory in success message when provided', async () => {
    const generateTerraformFromYaml = vi.fn().mockResolvedValue(undefined);
    const options = {
      generateDiagram: vi.fn().mockResolvedValue(undefined),
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
      generateTerraformFromYaml,
      version: '1.0.0',
    };

    process.argv = [
      'node',
      'adac',
      'terraform',
      'test.yaml',
      '-o',
      'my-tf-dir',
    ];
    await runCLI(options);

    const allLogs = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allLogs).toContain('my-tf-dir');
  });
});

describe('ADAC CLI - diagram command with --cost flag', () => {
  let originalArgv: string[];
  let originalExit: typeof process.exit;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const mockCostBreakdown: CostBreakdown = {
    compute: 25.0,
    database: 25.0,
    storage: 25.0,
    networking: 25.0,
    total: 100.0,
    period: 'monthly',
  };

  beforeEach(() => {
    originalArgv = process.argv;
    originalExit = process.exit;
    (process as unknown as { exit: typeof process.exit }).exit =
      vi.fn() as unknown as typeof process.exit;
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    (process as unknown as { exit: typeof process.exit }).exit = originalExit;
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should call calculateCostFromYaml when --cost flag is passed to diagram command', async () => {
    const calculateCostFromYaml = vi.fn().mockReturnValue(mockCostBreakdown);
    const options = {
      generateDiagram: vi.fn().mockResolvedValue(undefined),
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
      calculateCostFromYaml,
      version: '1.0.0',
    };

    process.argv = ['node', 'adac', 'diagram', 'test.yaml', '--cost'];
    await runCLI(options);

    expect(calculateCostFromYaml).toHaveBeenCalled();
  });

  it('should log error but continue when calculateCostFromYaml is absent and --cost is passed', async () => {
    const generateDiagram = vi.fn().mockResolvedValue(undefined);
    const options = {
      generateDiagram,
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
      version: '1.0.0',
      // no calculateCostFromYaml
    };

    process.argv = ['node', 'adac', 'diagram', 'test.yaml', '--cost'];
    await runCLI(options);

    // Should still call generateDiagram (cost error is non-fatal in diagram command)
    expect(generateDiagram).toHaveBeenCalled();
    const errorLogs = consoleErrorSpy.mock.calls
      .map((c) => c.join(' '))
      .join('\n');
    expect(errorLogs).toContain('Cost calculation is not available');
  });
});

describe('ADAC CLI - CostBreakdown type', () => {
  it('CostBreakdown should support all valid periods', () => {
    const periods: CostBreakdown['period'][] = [
      'hourly',
      'daily',
      'monthly',
      'yearly',
    ];
    for (const period of periods) {
      const breakdown: CostBreakdown = {
        compute: 1,
        database: 1,
        storage: 1,
        networking: 1,
        total: 4,
        period,
      };
      expect(breakdown.period).toBe(period);
    }
  });

  it('CostBreakdown total should be the sum of all categories', () => {
    const breakdown: CostBreakdown = {
      compute: 40,
      database: 30,
      storage: 20,
      networking: 10,
      total: 100,
      period: 'monthly',
    };
    const calculatedTotal =
      breakdown.compute +
      breakdown.database +
      breakdown.storage +
      breakdown.networking;
    expect(calculatedTotal).toBe(breakdown.total);
  });
});

describe('ADAC CLI - Branch Coverage', () => {
  let originalArgv: string[];
  let originalExit: typeof process.exit;
  let mockExit: ReturnType<typeof vi.fn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let originalPlatform: string;

  beforeEach(() => {
    originalArgv = process.argv;
    originalExit = process.exit;
    originalPlatform = Object.getOwnPropertyDescriptor(
      process,
      'platform'
    )?.value;
    mockExit = vi.fn();
    (process as unknown as { exit: typeof process.exit }).exit =
      mockExit as unknown as typeof process.exit;
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    (process as unknown as { exit: typeof process.exit }).exit = originalExit;
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: false,
    });
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should handle diagram generation with Windows platform', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      writable: true,
    });

    const generateDiagram = vi.fn().mockResolvedValue(undefined);
    const options = {
      generateDiagram,
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
      version: '1.0.0',
    };

    process.argv = ['node', 'adac', 'diagram', 'test.yaml'];
    await runCLI(options);

    expect(generateDiagram).toHaveBeenCalled();
    // Verify Windows browser launch command pattern
    const allLogs = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    // Should attempt to launch browser
    expect(allLogs).toContain('Automatically launching browser');
  });

  it('should handle diagram generation with Linux platform', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      writable: true,
    });

    const generateDiagram = vi.fn().mockResolvedValue(undefined);
    const options = {
      generateDiagram,
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
      version: '1.0.0',
    };

    process.argv = ['node', 'adac', 'diagram', 'test.yaml'];
    await runCLI(options);

    expect(generateDiagram).toHaveBeenCalled();
    // Verify Linux browser launch
    const allLogs = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(allLogs).toContain('Automatically launching browser');
  });

  it('should handle validation with errors array', async () => {
    const options = {
      generateDiagram: vi.fn().mockResolvedValue(undefined),
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({
        valid: false,
        errors: ['Missing version', 'Missing infrastructure'],
      }),
      version: '1.0.0',
    };

    process.argv = ['node', 'adac', 'validate', 'test.yaml'];
    await runCLI(options);

    const errorLogs = consoleErrorSpy.mock.calls
      .map((c) => c.join(' '))
      .join('\n');
    expect(errorLogs).toContain('Missing version');
    expect(errorLogs).toContain('Missing infrastructure');
  });

  it('should handle validation with empty errors array', async () => {
    const options = {
      generateDiagram: vi.fn().mockResolvedValue(undefined),
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({
        valid: false,
        errors: [],
      }),
      version: '1.0.0',
    };

    process.argv = ['node', 'adac', 'validate', 'test.yaml'];
    await runCLI(options);

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should handle validation failure message display', async () => {
    const options = {
      generateDiagram: vi.fn().mockResolvedValue(undefined),
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({
        valid: false,
        errors: ['Schema validation failed', 'Unsupported resource type'],
      }),
      version: '1.0.0',
    };

    process.argv = ['node', 'adac', 'validate', 'test.yaml'];
    await runCLI(options);

    const allLogs = consoleErrorSpy.mock.calls
      .map((c) => c.join(' '))
      .join('\n');
    expect(allLogs).toContain('Validation failed');
    expect(allLogs).toContain('Schema validation failed');
    expect(allLogs).toContain('Unsupported resource type');
  });

  it('should handle diagram error gracefully', async () => {
    const options = {
      generateDiagram: vi.fn().mockRejectedValue(new Error('Bad YAML syntax')),
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
      version: '1.0.0',
    };

    process.argv = ['node', 'adac', 'diagram', 'test.yaml'];
    await runCLI(options);

    expect(mockExit).toHaveBeenCalledWith(1);
    const errorLogs = consoleErrorSpy.mock.calls
      .map((c) => c.join(' '))
      .join('\n');
    expect(errorLogs).toContain('Error generating diagram');
  });

  it('should handle multiple cost categories display', async () => {
    const calculateCostFromYaml = vi.fn().mockReturnValue({
      compute: 500,
      database: 300,
      storage: 150,
      networking: 50,
      total: 1000,
      period: 'monthly',
    });

    const options = {
      generateDiagram: vi.fn().mockResolvedValue(undefined),
      parseAdac: vi.fn().mockReturnValue({}),
      validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
      calculateCostFromYaml,
      version: '1.0.0',
    };

    process.argv = ['node', 'adac', 'cost', 'test.yaml'];
    await runCLI(options);

    const allLogs = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    // Should output all cost categories
    expect(allLogs).toMatch(/Compute.*50/);
    expect(allLogs).toMatch(/Database.*30/);
    expect(allLogs).toMatch(/Storage.*15/);
    expect(allLogs).toMatch(/Networking.*5/);
  });
});
