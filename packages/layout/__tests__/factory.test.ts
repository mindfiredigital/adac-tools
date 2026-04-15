import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createLayoutEngine } from '../src/factory';
import * as autoSelector from '../src/auto-selector';
import { CustomLayoutEngineAdapter } from '../src/custom-layout-engine-adapter';

// Mock engines
vi.mock('@mindfiredigital/adac-layout-core', () => ({
  CustomLayoutEngine: vi.fn().mockImplementation(function () {
    return { type: 'custom' };
  }),
}));

let elkMockError: any = null;
vi.mock('@mindfiredigital/adac-layout-elk', () => {
  return {
    get ElkLayoutEngine() {
      if (elkMockError) throw elkMockError;
      return vi.fn().mockImplementation(function () {
        return { type: 'elk' };
      });
    },
  };
});

describe('createLayoutEngine', () => {
  beforeEach(() => {
    elkMockError = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    elkMockError = null;
  });

  it('returns CustomLayoutEngine when type is custom', async () => {
    const engine = await createLayoutEngine('custom');
    expect(engine).toBeInstanceOf(CustomLayoutEngineAdapter);
  });

  it('returns ElkLayoutEngine when type is elk', async () => {
    const engine = await createLayoutEngine('elk');
    expect(engine).toEqual({ type: 'elk' });
  });

  it('uses custom engine in auto mode when complexity is false', async () => {
    vi.spyOn(autoSelector, 'analyzeComplexity').mockReturnValue(false);

    const engine = await createLayoutEngine('auto', {}, {});

    expect(autoSelector.analyzeComplexity).toHaveBeenCalled();
    expect(engine).toBeInstanceOf(CustomLayoutEngineAdapter);
  });

  it('uses elk engine in auto mode when complexity is true', async () => {
    vi.spyOn(autoSelector, 'analyzeComplexity').mockReturnValue(true);

    const engine = await createLayoutEngine('auto', {}, {});

    expect(engine).toEqual({ type: 'elk' });
  });

  it('passes options to CustomLayoutEngine', async () => {
    const options = { nodesep: 50 };

    const { CustomLayoutEngine } =
      await import('@mindfiredigital/adac-layout-core');

    await createLayoutEngine('custom', options);

    expect(CustomLayoutEngine).toHaveBeenCalledWith(options);
  });

  it('throws error for invalid type', async () => {
    await expect(
      createLayoutEngine('invalid' as unknown as any)
    ).rejects.toThrow('Unknown engine type: invalid');
  });

  it('falls back to custom engine if ELK is not found (MODULE_NOT_FOUND)', async () => {
    elkMockError = { code: 'MODULE_NOT_FOUND' };
    const engine = await createLayoutEngine('elk');
    expect(engine).toBeInstanceOf(CustomLayoutEngineAdapter);
  });

  it('re-throws error if ELK fails with non-not-found error', async () => {
    elkMockError = new Error('Some other error');
    await expect(createLayoutEngine('elk')).rejects.toThrow('Some other error');
  });
});
