import { describe, it, expect, vitest } from 'vitest';
import { layoutDagre } from '../src/index.js';
import { ElkNode } from '@mindfiredigital/adac-layout-elk';

describe('Dagre Layout', () => {
  it('should layout an ELK node with children and edges', async () => {
    const root: ElkNode = {
      id: 'root',
      properties: { type: 'container' },
      children: [
        {
          id: 'child1',
          width: 100,
          height: 100,
          properties: { type: 'node' }
        },
        {
          id: 'child2',
          width: 50,
          height: 50,
          properties: { type: 'node' }
        },
        {
          id: 'container1',
          properties: { type: 'container' },
          children: [
            { id: 'subchild1', width: 200, height: 100, properties: { type: 'node' } },
            { id: 'subchild2', width: 50, height: 50, properties: { type: 'node' } }
          ],
          edges: [
            { id: 'e-internal', sources: ['subchild1'], targets: ['subchild2'] }
          ]
        }
      ],
      edges: [
        { id: 'e1', sources: ['child1'], targets: ['child2'] },
        { id: 'e2', sources: ['child1'], targets: ['subchild1'] },
        { id: 'e-container', sources: ['child2'], targets: ['container1'] }, // triggers getAnchor creation
        { id: 'e-container-2', sources: ['child1'], targets: ['container1'] } // triggers getAnchor cached
      ]
    };

    const laidOut = await layoutDagre(root);
    expect(laidOut).toBeDefined();
    
    // Check that positions were assigned
    const c1 = laidOut.children?.find(c => c.id === 'child1');
    expect(c1?.x).toBeDefined();
    expect(c1?.y).toBeDefined();
    
    const c2 = laidOut.children?.find(c => c.id === 'child2');
    expect(c2?.x).toBeDefined();
    expect(c2?.y).toBeDefined();

    // ensure edges have sections and routing points
    const edge = laidOut.edges?.find(e => e.id === 'e-container');
    expect(edge?.sections).toBeDefined();
  });

  it('should handle empty root gracefully', async () => {
    const rootInfo: ElkNode = { id: 'empty-root' };
    const result = await layoutDagre(rootInfo);
    expect(result.id).toBe('empty-root');
  });
  
  it('should handle deeply nested nodes and edges cross-boundary', async () => {
    const nestedRoot: ElkNode = {
      id: 'root-2',
      children: [
        {
           id: 'parent-1',
           properties: { type: 'container' },
           children: [
              { id: 'leaf-1', width: 10, height: 10, properties: { type: 'node' } }
           ]
        },
        {
           id: 'parent-2',
           properties: { type: 'container' },
           children: [
              { id: 'leaf-2', width: 100, height: 10, properties: { type: 'node' } }
           ]
        }
      ],
      edges: [
        { id: 'cross', sources: ['parent-1'], targets: ['leaf-2'] },
        { id: 'cross-2', sources: ['leaf-1'], targets: ['leaf-2'] },
        { id: 'self', sources: ['leaf-1'], targets: ['leaf-1'] }, // triggers u===v branch
        { id: 'ancestor', sources: ['parent-1'], targets: ['leaf-1'] } // triggers ancestor branch
      ]
    };
    const res = await layoutDagre(nestedRoot);
    expect(res).toBeDefined();
    const e = res.edges?.[0];
    expect(e?.sections).toBeDefined();
  });

  it('should throw gracefully if dagre layout fails', async () => {
    // import dagre to spy on it
    const dagre = await import('dagre');
    const layoutSpy = vitest.spyOn(dagre.default || dagre, 'layout').mockImplementationOnce(() => {
      throw new Error('Forced crash');
    });
    
    const rootInfo: ElkNode = { id: 'root' };
    await expect(layoutDagre(rootInfo)).rejects.toThrow('Dagre layout failed: Forced crash');
    layoutSpy.mockRestore();
  });
});
