import { describe, it, expect } from 'vitest';
import { optimize } from '../src/index';

describe('Optimizer', () => {
  it('should optimize configuration', () => {
    const config = { metadata: { name: 'test' } };
    const result = optimize(config);
    expect(result.metadata.optimized).toBe(true);
  });
});
