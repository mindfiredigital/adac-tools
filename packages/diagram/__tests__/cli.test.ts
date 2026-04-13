import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import path from 'path';
import { runCLI } from '@mindfiredigital/adac-cli';
import {
  generateDiagram,
  parseAdac,
  validateAdacConfig,
} from '@mindfiredigital/adac-core';
import {
  calculatePerServiceCosts,
  aggregateCostFromYaml,
} from '@mindfiredigital/adac-cost';
import { generateTerraformFromAdacFile } from '@mindfiredigital/adac-export-terraform';

vi.mock('fs', () => ({
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('path', () => ({
  default: {
    resolve: vi.fn((...args) => args.join('/')),
    parse: vi.fn(() => ({ dir: 'mock/dir', name: 'mockName' })),
    join: vi.fn((...args) => args.join('/')),
  },
  resolve: vi.fn((...args) => args.join('/')),
  parse: vi.fn(() => ({ dir: 'mock/dir', name: 'mockName' })),
  join: vi.fn((...args) => args.join('/')),
}));

vi.mock('@mindfiredigital/adac-cli', () => ({
  runCLI: vi.fn(),
}));

vi.mock('@mindfiredigital/adac-core', () => ({
  generateDiagram: vi.fn(),
  parseAdac: vi.fn(),
  validateAdacConfig: vi.fn(),
}));

vi.mock('@mindfiredigital/adac-cost', () => ({
  calculatePerServiceCosts: vi.fn(),
  aggregateCostFromYaml: vi.fn(),
}));

vi.mock('@mindfiredigital/adac-export-terraform', () => ({
  generateTerraformFromAdacFile: vi.fn(),
}));

describe('cli.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  async function loadCli() {
    return await import('../src/cli');
  }

  it('should read package.json version and call runCLI with the correct config', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ version: '1.2.3' })
    );

    await loadCli();

    expect(fs.readFileSync).toHaveBeenCalledWith(
      expect.stringContaining('package.json'),
      'utf-8'
    );
    expect(runCLI).toHaveBeenCalledTimes(1);

    const runCLIArg = vi.mocked(runCLI).mock.calls[0][0];
    expect(runCLIArg.version).toBe('1.2.3');
    expect(runCLIArg.parseAdac).toBe(parseAdac);
    expect(runCLIArg.validateAdacConfig).toBe(validateAdacConfig);
    expect(runCLIArg.calculateCostFromYaml).toBe(aggregateCostFromYaml);
  });

  it('should handle package.json read error and fallback to default version 0.1.0', async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('Not found');
    });

    await loadCli();

    const runCLIArg = vi.mocked(runCLI).mock.calls[0][0];
    expect(runCLIArg.version).toBe('0.1.0');
  });

  it('should test generateDiagram logic passed to runCLI', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ version: '1.2.3' })
    );
    await loadCli();

    const runCLIArg = vi.mocked(runCLI).mock.calls[0][0] as Parameters<
      typeof runCLI
    >[0];

    vi.mocked(parseAdac).mockReturnValue({ some: 'config' });
    vi.mocked(calculatePerServiceCosts).mockReturnValue({ s3: 10 });
    vi.mocked(generateDiagram).mockResolvedValue(undefined);

    await runCLIArg.generateDiagram(
      'input.yaml',
      'output.png',
      'elk',
      true,
      {},
      'monthly',
      'on_demand'
    );

    expect(parseAdac).toHaveBeenCalledWith('input.yaml', { validate: false });
    expect(calculatePerServiceCosts).toHaveBeenCalledWith(
      { some: 'config' },
      'monthly',
      'on_demand'
    );
    expect(generateDiagram).toHaveBeenCalledWith(
      'input.yaml',
      'output.png',
      'elk',
      true,
      { s3: 10 },
      'monthly'
    );
    // In current implementation, generateDiagram does not return a value, we can just assert it was called.
  });

  it('should handle undefined pricingModel in generateDiagram', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ version: '1.2.3' })
    );
    await loadCli();

    const runCLIArg = vi.mocked(runCLI).mock.calls[0][0] as Parameters<
      typeof runCLI
    >[0];
    vi.mocked(parseAdac).mockReturnValue(undefined);
    await runCLIArg.generateDiagram(
      'in.yaml',
      'out.png',
      'dagre',
      false,
      undefined,
      'hourly'
    );
    expect(calculatePerServiceCosts).toHaveBeenCalledWith(
      undefined,
      'hourly',
      'on_demand'
    );
  });

  it('should test generateTerraformFromYaml logic passed to runCLI with default args', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ version: '1.2.3' })
    );
    await loadCli();

    const runCLIArg = vi.mocked(runCLI).mock.calls[0][0] as Parameters<
      typeof runCLI
    >[0];

    vi.mocked(generateTerraformFromAdacFile).mockReturnValue({
      mainTf: 'main-content',
      variablesTf: 'variables-content',
      outputsTf: 'outputs-content',
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runCLIArg.generateTerraformFromYaml!('input.yaml');

    expect(generateTerraformFromAdacFile).toHaveBeenCalledWith('input.yaml', {
      validate: true,
    });
    expect(path.parse).toHaveBeenCalledWith('input.yaml');
    expect(path.resolve).toHaveBeenCalledWith('mock/dir', 'mockName-terraform');
    expect(fs.mkdirSync).toHaveBeenCalledWith('mock/dir/mockName-terraform', {
      recursive: true,
    });
    expect(fs.writeFileSync).toHaveBeenCalledTimes(3);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      'mock/dir/mockName-terraform/main.tf',
      'main-content'
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      'mock/dir/mockName-terraform/variables.tf',
      'variables-content'
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      'mock/dir/mockName-terraform/outputs.tf',
      'outputs-content'
    );
    expect(logSpy).toHaveBeenCalledWith(
      'Terraform files written to mock/dir/mockName-terraform'
    );

    logSpy.mockRestore();
  });

  it('should test generateTerraformFromYaml with explicit outputDir and validate=false', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ version: '1.2.3' })
    );
    await loadCli();

    const runCLIArg = vi.mocked(runCLI).mock.calls[0][0] as Parameters<
      typeof runCLI
    >[0];

    vi.mocked(generateTerraformFromAdacFile).mockReturnValue({
      mainTf: 'main2',
      variablesTf: 'var2',
      outputsTf: 'out2',
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runCLIArg.generateTerraformFromYaml!(
      'input.yaml',
      'custom-dir',
      false
    );

    expect(generateTerraformFromAdacFile).toHaveBeenCalledWith('input.yaml', {
      validate: false,
    });
    expect(fs.mkdirSync).toHaveBeenCalledWith('custom-dir', {
      recursive: true,
    });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      'custom-dir/main.tf',
      'main2'
    );

    logSpy.mockRestore();
  });

  it('should propagate core generateDiagram errors', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ version: '1.2.3' }));
    await loadCli();
    const runCLIArg = vi.mocked(runCLI).mock.calls[0][0] as Parameters<typeof runCLI>[0];

    vi.mocked(parseAdac).mockReturnValue({ some: 'config' });
    vi.mocked(calculatePerServiceCosts).mockReturnValue({ s3: 10 });
    vi.mocked(generateDiagram).mockRejectedValue(new Error('diagram failed'));

    await expect(
      runCLIArg.generateDiagram('input.yaml', 'output.png')
    ).rejects.toThrow('diagram failed');

    expect(parseAdac).toHaveBeenCalled();
    expect(calculatePerServiceCosts).toHaveBeenCalled();
  });

  it('should surface terraform generation errors and skip writes', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ version: '1.2.3' }));
    await loadCli();
    const runCLIArg = vi.mocked(runCLI).mock.calls[0][0] as Parameters<typeof runCLI>[0];

    vi.mocked(generateTerraformFromAdacFile).mockImplementation(() => {
      throw new Error('terraform failed');
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(
      runCLIArg.generateTerraformFromYaml!('input.yaml')
    ).rejects.toThrow('terraform failed');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });
});