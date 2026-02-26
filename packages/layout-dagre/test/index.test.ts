import { describe, it, expect } from 'vitest';
import { layoutDagre } from '../src/index.js';

describe('Dagre Layout', () => {
  it('should layout a simple graph', async () => {
    const graph = {
      id: 'root',
      children: [
        { id: 'n1', width: 100, height: 100 },
        { id: 'n2', width: 100, height: 100 }
      ],
      edges: [
        { id: 'e1', sources: ['n1'], targets: ['n2'] }
      ]
    };
    const result = await layoutDagre(graph as any);
    expect(result.children?.some(c => c.x !== undefined)).toBe(true);
    expect(result.edges?.[0].sections).toBeDefined();
  });

  it('should handle multiple edges', async () => {
    const graph = {
      id: 'root',
      children: [
        { id: 'n1', width: 100, height: 100 },
        { id: 'n2', width: 100, height: 100 },
        { id: 'n3', width: 100, height: 100 }
      ],
      edges: [
        { id: 'e1', sources: ['n1'], targets: ['n2'] },
        { id: 'e2', sources: ['n1'], targets: ['n3'] }
      ]
    };
    const result = await layoutDagre(graph as any);
    expect(result.edges?.length).toBe(2);
  });
});
