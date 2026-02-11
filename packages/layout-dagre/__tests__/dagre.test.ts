import { layoutDagre } from '../src/index';
import { ElkNode } from '@mindfiredigital/adac-layout-elk';

describe('Dagre Layout', () => {
  describe('layoutDagre', () => {
    it('should layout simple graph with single node', async () => {
      const input: ElkNode = {
        id: 'root',
        children: [
          {
            id: 'node-1',
            width: 100,
            height: 60,
          },
        ],
      };

      const result = await layoutDagre(input);

      expect(result.id).toBe('root');
      expect(result.children).toBeDefined();
      expect(result.children![0].x).toBeDefined();
      expect(result.children![0].y).toBeDefined();
    });

    it('should layout graph with multiple nodes', async () => {
      const input: ElkNode = {
        id: 'root',
        children: [
          {
            id: 'node-1',
            width: 100,
            height: 60,
          },
          {
            id: 'node-2',
            width: 100,
            height: 60,
          },
          {
            id: 'node-3',
            width: 100,
            height: 60,
          },
        ],
      };

      const result = await layoutDagre(input);

      expect(result.children).toHaveLength(3);
      result.children!.forEach((child) => {
        expect(child.x).toBeDefined();
        expect(child.y).toBeDefined();
      });
    });

    it('should layout graph with edges', async () => {
      const input: ElkNode = {
        id: 'root',
        children: [
          {
            id: 'node-1',
            width: 100,
            height: 60,
          },
          {
            id: 'node-2',
            width: 100,
            height: 60,
          },
        ],
        edges: [
          {
            id: 'edge-1',
            sources: ['node-1'],
            targets: ['node-2'],
          },
        ],
      };

      const result = await layoutDagre(input);

      expect(result.edges).toBeDefined();
      expect(result.edges![0].sections).toBeDefined();
    });

    it('should layout hierarchical graph with nested children', async () => {
      const input: ElkNode = {
        id: 'root',
        children: [
          {
            id: 'container-1',
            children: [
              {
                id: 'child-1',
                width: 80,
                height: 50,
              },
              {
                id: 'child-2',
                width: 80,
                height: 50,
              },
            ],
          },
        ],
      };

      const result = await layoutDagre(input);

      expect(result.children).toBeDefined();
      expect(result.children![0].children).toBeDefined();
      expect(result.children![0].children![0].x).toBeDefined();
    });

    it('should set default dimensions for nodes without size', async () => {
      const input: ElkNode = {
        id: 'root',
        children: [
          {
            id: 'node-1',
            // No width/height specified
          },
        ],
      };

      const result = await layoutDagre(input);

      expect(result.children![0].width).toBe(80);
      expect(result.children![0].height).toBe(60);
    });

    it('should handle edges between nested nodes', async () => {
      const input: ElkNode = {
        id: 'root',
        children: [
          {
            id: 'container-1',
            children: [
              {
                id: 'child-1',
                width: 80,
                height: 50,
              },
            ],
          },
          {
            id: 'container-2',
            children: [
              {
                id: 'child-2',
                width: 80,
                height: 50,
              },
            ],
          },
        ],
        edges: [
          {
            id: 'edge-1',
            sources: ['child-1'],
            targets: ['child-2'],
            container: 'root',
          },
        ],
      };

      const result = await layoutDagre(input);

      expect(result.edges).toBeDefined();
      expect(result.edges![0].sections).toBeDefined();
    });

    it('should calculate bounding boxes for containers', async () => {
      const input: ElkNode = {
        id: 'root',
        children: [
          {
            id: 'container-1',
            children: [
              {
                id: 'child-1',
                width: 100,
                height: 60,
              },
              {
                id: 'child-2',
                width: 100,
                height: 60,
              },
            ],
          },
        ],
      };

      const result = await layoutDagre(input);

      const container = result.children![0];
      expect(container.width).toBeGreaterThan(0);
      expect(container.height).toBeGreaterThan(0);
    });

    it('should handle empty graph', async () => {
      const input: ElkNode = {
        id: 'root',
        children: [],
      };

      const result = await layoutDagre(input);

      expect(result.id).toBe('root');
      expect(result.children).toHaveLength(0);
    });

    it('should preserve node properties', async () => {
      const input: ElkNode = {
        id: 'root',
        children: [
          {
            id: 'node-1',
            width: 120,
            height: 80,
            properties: {
              type: 'service',
              iconPath: '/path/to/icon.png',
            },
            labels: [{ text: 'Test Node' }],
          },
        ],
      };

      const result = await layoutDagre(input);

      const node = result.children![0];
      expect(node.properties?.type).toBe('service');
      expect(node.properties?.iconPath).toBe('/path/to/icon.png');
      expect(node.labels).toHaveLength(1);
    });

    it('should handle multiple edges from same source', async () => {
      const input: ElkNode = {
        id: 'root',
        children: [
          { id: 'node-1', width: 100, height: 60 },
          { id: 'node-2', width: 100, height: 60 },
          { id: 'node-3', width: 100, height: 60 },
        ],
        edges: [
          {
            id: 'edge-1',
            sources: ['node-1'],
            targets: ['node-2'],
          },
          {
            id: 'edge-2',
            sources: ['node-1'],
            targets: ['node-3'],
          },
        ],
      };

      const result = await layoutDagre(input);

      expect(result.edges).toHaveLength(2);
    });
  });
});
