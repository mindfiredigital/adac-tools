import { describe, it, expect, vi } from 'vitest';
import { CustomLayoutEngineAdapter } from '../src/custom-layout-engine-adapter';

// Mock the core engine if needed, but here we can just test if it delegates correctly
describe('CustomLayoutEngineAdapter', () => {
  it('should instantiate and delegate calls', () => {
    const adapter = new CustomLayoutEngineAdapter();

    // Test addNode
    const addNodeSpy = vi.spyOn(adapter['engine'], 'addNode');
    adapter.addNode('n1', { width: 100, height: 100 });
    expect(addNodeSpy).toHaveBeenCalledWith('n1', { width: 100, height: 100 });

    // Test addEdge
    const addEdgeSpy = vi.spyOn(adapter['engine'], 'addEdge');
    adapter.addEdge('n1', 'n2', { weight: 1 });
    expect(addEdgeSpy).toHaveBeenCalledWith('n1', 'n2', { weight: 1 });

    // Test layout
    const layoutSpy = vi
      .spyOn(adapter['engine'], 'layout')
      .mockReturnValue({ nodes: {}, edges: [] });
    const result = adapter.layout();
    expect(layoutSpy).toHaveBeenCalled();
    expect(result).toEqual({ nodes: {}, edges: [] });
  });
});
