import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLayoutEngine } from '../src/factory'
import * as autoSelector from '../src/auto-selector';

// Mock engines
vi.mock('@mindfiredigital/adac-layout-core', () => ({
  CustomLayoutEngine: vi.fn().mockImplementation(function () {
    return { type: 'custom' };
  }),
}));

vi.mock('@mindfiredigital/adac-layout-elk', () => ({
  ElkLayoutEngine: vi.fn().mockImplementation(function () {
    return { type: 'elk' };
  }),
}));

describe('createLayoutEngine', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns CustomLayoutEngine when type is custom', async () => {
    const engine = await createLayoutEngine('custom');
    expect(engine).toEqual({ type: 'custom' });
  });

  it('returns ElkLayoutEngine when type is elk', async () => {
    const engine = await createLayoutEngine('elk');
    expect(engine).toEqual({ type: 'elk' });
  });

  it('uses custom engine in auto mode when complexity is false', async () => {
    vi.spyOn(autoSelector, 'analyzeComplexity').mockReturnValue(false);

    const engine = await createLayoutEngine('auto', {}, {});

    expect(autoSelector.analyzeComplexity).toHaveBeenCalled();
    expect(engine).toEqual({ type: 'custom' });
  });

  it('uses elk engine in auto mode when complexity is true', async () => {
    vi.spyOn(autoSelector, 'analyzeComplexity').mockReturnValue(true);

    const engine = await createLayoutEngine('auto', {}, {});

    expect(engine).toEqual({ type: 'elk' });
  });

  it('passes options to CustomLayoutEngine', async () => {
    const options = { nodesep: 50 };

    const { CustomLayoutEngine } = await import('@mindfiredigital/adac-layout-core');

    await createLayoutEngine('custom', options);

    expect(CustomLayoutEngine).toHaveBeenCalledWith(options);
  });

  it('throws error for invalid type', async () => {
    await expect(
      createLayoutEngine('invalid' as any)
    ).rejects.toThrow('Unknown engine type: invalid');
  });
});
