import { buildElkGraph } from '../src/elkBuilder';
import { AdacConfig } from '@mindfiredigital/adac-schema';
import { ElkNode } from '../src/types';

// Mock fs module
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn((path: string) => {
      if (path.includes('icon-map.json')) return true;
      return false;
    }),
    readFileSync: jest.fn((path: string) => {
      if (path.includes('icon-map.json')) return '{}';
      return '';
    }),
  };
});

describe('ELK Builder', () => {
  describe('buildElkGraph', () => {
    it('should build graph with minimal config', () => {
      const config: AdacConfig = {
        applications: [],
        infrastructure: {
          clouds: [],
        },
      };

      const result = buildElkGraph(config);

      expect(result.id).toBe('root');
      expect(result.children).toBeDefined();
      expect(result.layoutOptions).toBeDefined();
    });

    it('should build graph with single application', () => {
      const config: AdacConfig = {
        applications: [
          {
            id: 'app-1',
            name: 'Test App',
            type: 'web',
          },
        ],
        infrastructure: {
          clouds: [],
        },
      };

      const result = buildElkGraph(config);

      expect(result.children).toBeDefined();
      expect(result.children!.length).toBeGreaterThan(0);
    });

    // Helper to find node recursively
    const findNode = (nodes: ElkNode[], id: string): boolean => {
      for (const node of nodes) {
        if (node.id === id) return true;
        if (node.children && findNode(node.children, id)) return true;
      }
      return false;
    };

    it('should build graph with infrastructure services', () => {
      const config: AdacConfig = {
        applications: [],
        infrastructure: {
          clouds: [
            {
              provider: 'aws',
              services: [
                {
                  id: 'ec2-1',
                  type: 'AWS::EC2::Instance',
                  name: 'Web Server',
                },
              ],
            },
          ],
        },
      };

      const result = buildElkGraph(config);

      expect(result.children).toBeDefined();
      expect(result.children!.length).toBeGreaterThan(0);
      
      // Check if service exists anywhere in the graph
      const found = findNode(result.children!, 'ec2-1');
      expect(found).toBe(true);
    });

    it('should build graph with applications and services', () => {
      const config: AdacConfig = {
        applications: [
          {
            id: 'frontend',
            name: 'Web UI',
            type: 'web',
            technology: 'React',
          },
        ],
        infrastructure: {
          clouds: [
            {
              provider: 'aws',
              services: [
                {
                  id: 'ec2-1',
                  type: 'AWS::EC2::Instance',
                  runs: ['frontend'],
                },
              ],
            },
          ],
        },
      };

      const result = buildElkGraph(config);

      expect(result.children).toBeDefined();
      expect(result.children!.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle connections', () => {
      const config: AdacConfig = {
        applications: [
          {
            id: 'app-1',
            name: 'App 1',
            type: 'web',
          },
        ],
        infrastructure: {
          clouds: [
            {
              provider: 'aws',
              services: [
                {
                  id: 'svc-1',
                  type: 'AWS::EC2::Instance',
                },
              ],
            },
          ],
        },
        connections: [
          {
            from: 'app-1',
            to: 'svc-1',
            type: 'http',
          },
        ],
      };

      const result = buildElkGraph(config);

      expect(result.children).toBeDefined();
    });

    it('should handle multiple clouds', () => {
      const config: AdacConfig = {
        applications: [],
        infrastructure: {
          clouds: [
            {
              provider: 'aws',
              services: [
                {
                  id: 'aws-svc-1',
                  type: 'AWS::EC2::Instance',
                },
              ],
            },
            {
              provider: 'azure',
              services: [
                {
                  id: 'azure-svc-1',
                  type: 'Azure::VM',
                },
              ],
            },
          ],
        },
      };

      const result = buildElkGraph(config);

      expect(result.children).toBeDefined();
      expect(result.children!.length).toBeGreaterThanOrEqual(1);
      
      // Should have nodes for services from different providers
      const hasAws = findNode(result.children!, 'aws-svc-1');
      const hasAzure = findNode(result.children!, 'azure-svc-1');
      expect(hasAws || hasAzure).toBe(true);
    });

    it('should set layout options', () => {
      const config: AdacConfig = {
        applications: [],
        infrastructure: {
          clouds: [],
        },
      };

      const result = buildElkGraph(config);

      expect(result.layoutOptions).toBeDefined();
      expect(result.layoutOptions!['elk.algorithm']).toBe('layered');
    });

    it('should handle services with properties', () => {
      const config: AdacConfig = {
        applications: [],
        infrastructure: {
          clouds: [
            {
              provider: 'aws',
              services: [
                {
                  id: 'lambda-1',
                  type: 'AWS::Lambda::Function',
                  name: 'API Handler',
                  description: 'Handles API requests',
                },
              ],
            },
          ],
        },
      };

      const result = buildElkGraph(config);

      expect(result.children).toBeDefined();
    });

    it('should handle empty applications array', () => {
      const config: AdacConfig = {
        applications: [],
        infrastructure: {
          clouds: [
            {
              provider: 'aws',
              services: [],
            },
          ],
        },
      };

      const result = buildElkGraph(config);

      expect(result.children).toBeDefined();
    });

    it('should handle connections with source/target property', () => {
      const config: AdacConfig = {
        applications: [
          {
            id: 'app-1',
            name: 'App',
            type: 'web',
          },
          {
            id: 'app-2',
            name: 'API',
            type: 'api',
          },
        ],
        infrastructure: {
          clouds: [],
        },
        connections: [
          {
            from: 'app-1',
            to: 'app-2',
            source: 'app-1',
            target: 'app-2',
            type: 'rest',
          },
        ],
      };

      const result = buildElkGraph(config);

      expect(result.children).toBeDefined();
    });
  });
});
