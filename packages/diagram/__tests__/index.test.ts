import { describe, it, expect } from 'vitest';
import * as Module from '../src/index';

describe('index.ts', () => {
  it('should re-export generateDiagram from `@mindfiredigital/adac-core`', async () => {
    expect(Module).toBeDefined();
    expect(Module).toHaveProperty('generateDiagram');
    expect(typeof (Module as any).generateDiagram).toBe('function');
  });
});
