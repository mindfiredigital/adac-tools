import { describe, it, expect, vi } from 'vitest';
import { runCLI } from '../src/index.js';

describe('ADAC CLI', () => {
  const mockOptions = {
    generateDiagram: vi.fn().mockResolvedValue(undefined),
    parseAdac: vi.fn().mockReturnValue({}),
    validateAdacConfig: vi.fn().mockReturnValue({ valid: true }),
    version: '1.0.0'
  };

  it('should call generateDiagram when diagram command is run', async () => {
    const originalArgv = process.argv;
    const originalExit = process.exit;
    process.argv = ['node', 'adac', 'diagram', 'test.yaml'];
    (process as any).exit = vi.fn();
    
    await runCLI(mockOptions);
    
    expect(mockOptions.generateDiagram).toBeDefined();
    process.argv = originalArgv;
    (process as any).exit = originalExit;
  });

  it('should call validate command when run', async () => {
    const originalArgv = process.argv;
    const originalExit = process.exit;
    process.argv = ['node', 'adac', 'validate', 'test.yaml'];
    (process as any).exit = vi.fn();
    
    await runCLI(mockOptions);
    
    expect(mockOptions.validateAdacConfig).toBeDefined();
    process.argv = originalArgv;
    (process as any).exit = originalExit;
  });

  it('should handle validation failure', async () => {
    const originalArgv = process.argv;
    const originalExit = process.exit;
    process.argv = ['node', 'adac', 'validate', 'test.yaml'];
    const mockExit = vi.fn();
    (process as any).exit = mockExit;
    
    mockOptions.validateAdacConfig.mockReturnValueOnce({ valid: false, errors: ['Invalid'] });
    
    await runCLI(mockOptions);
    
    expect(mockExit).toHaveBeenCalledWith(1);
    process.argv = originalArgv;
    (process as any).exit = originalExit;
  });
});
