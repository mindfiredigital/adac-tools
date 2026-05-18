/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect } from 'vitest';
import { analyzeComplexity } from '../src/auto-selector';

describe('analyzeComplexity', () => {
  it('should return false for empty model', () => {
    expect(analyzeComplexity()).toBe(false);
    expect(analyzeComplexity({})).toBe(false);
  });

  it('should return false for simple models', () => {
    const model = {
      infrastructure: {
        clouds: [
          {
            name: 'aws',
            services: [{ id: 's1', type: 'ec2' }],
          },
        ],
      },
    };
    expect(analyzeComplexity(model as any)).toBe(false);
  });

  it('should return true for complex models with many services', () => {
    const services = Array.from({ length: 201 }, (_, i) => ({
      id: `s${i}`,
      type: 'ec2',
    }));
    const model = {
      infrastructure: {
        clouds: [
          {
            name: 'aws',
            services,
          },
        ],
      },
    };
    expect(analyzeComplexity(model as any)).toBe(true);
  });

  it('should return true for complex models with many edges', () => {
    const connections = Array.from({ length: 301 }, (_, i) => ({
      from: 'a',
      to: 'b',
    }));
    const model = {
      connections,
    };
    expect(analyzeComplexity(model as any)).toBe(true);
  });
});
