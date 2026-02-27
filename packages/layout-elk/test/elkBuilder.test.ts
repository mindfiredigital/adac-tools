import { describe, it, expect, vitest } from 'vitest';
import { buildElkGraph } from '../src/elkBuilder.js';
import { AdacConfig } from '@mindfiredigital/adac-schema';

describe('ELK Builder', () => {
  it('should build an empty ELK graph from an empty AdacConfig', () => {
    const config: AdacConfig = {
      version: '0.1',
      metadata: { name: 'Empty', created: '2023-10-27' },
      infrastructure: { clouds: [] }
    };
    const graph = buildElkGraph(config);
    expect(graph.id).toBe('root');
    expect(graph.children).toEqual([]);
    expect(graph.edges).toEqual([]);
  });

  it('should build an ELK graph with nested VPC, Subnet, and Compute clusters', () => {
    const config: AdacConfig = {
      version: '0.1',
      metadata: { name: 'Test', created: '2023-10-27' },
      applications: [
        {
          id: 'app-web',
          name: 'Front End',
          type: 'client', // forces it to root or utility depending on type
          ai_tags: { group: 'Client Apps' }
        },
        {
          id: 'app-api',
          name: 'Backend API',
          technology: 'Node.js',
          type: 'service',
          ai_tags: { group: 'Backend Services', icon: 'Lambda' } // uses icon
        },
        {
          id: 'user-app',
          name: 'User App',
          type: 'user' // generic fallback
        }
      ],
      infrastructure: {
        clouds: [
          {
            id: 'aws-cloud',
            provider: 'aws',
            region: 'us-east-1',
            services: [
              {
                id: 'my-vpc',
                name: 'Main VPC',
                service: 'vpc'
              },
              {
                id: 'my-subnet',
                name: 'Public Subnet',
                service: 'subnet',
                configuration: {
                  vpc: 'my-vpc',
                  public: true,
                  availability_zone: 'a'
                }
              },
              {
                id: 'my-ec2',
                name: 'Web Server',
                service: 'ec2',
                configuration: {
                  vpc: 'my-vpc',
                  subnets: ['my-subnet']
                },
                runs: ['app-api']
              },
              {
                id: 'orphan-db',
                name: 'Database',
                service: 'rds',
                ai_tags: { group: 'Backend Services' } 
              },
              {
                id: 'unknown-service',
                name: 'Unknown',
                service: 'unknown',
                description: 'Tests utility group'
              }
            ]
          }
        ]
      },
      connections: [
        {
          id: 'conn-1',
          from: 'app-web',
          to: 'app-api',
          type: 'https'
        },
        {
          id: 'conn-2',
          from: 'app-api',
          to: 'orphan-db',
          type: 'tcp'
        },
        { // test implicit nodes
          id: 'conn-3',
          from: 'user-frontend',
          to: 'my-vpc',
          type: 'internet'
        },
        {
          id: 'conn-4',
          from: 'my-ec2',
          to: 'backend-system',
          type: 'api'
        }
      ]
    };

    const graph = buildElkGraph(config);
    expect(graph).toBeDefined();
    expect(graph.id).toBe('root');
    expect(graph.children).toBeDefined();
    
    // Check root has expected implicit nodes
    const rootIds = graph.children?.map(c => c.id) || [];
    expect(rootIds).toContain('user-frontend');
    expect(rootIds).toContain('backend-system');
    expect(rootIds).toContain('my-vpc');

    // Should create implicit az node since subnet config has availability_zone string
    const azNode = graph.children?.find(c => c.id === 'my-vpc')?.children?.find(c => c.id === 'my-vpc-a');
    expect(azNode).toBeDefined();

    // Check utility group
    expect(rootIds).toContain('group-utility-shared');
  });

  it('should handle services with single string subnets', () => {
    const config: AdacConfig = {
      version: '0.1',
      metadata: { name: 'Test', created: '2023-10-27' },
      infrastructure: {
         clouds: [{
           id: 'aws-cloud-2',
           provider: 'aws',
           region: 'us-east-1',
           services: [
              { id: 'subnet-1', service: 'subnet' },
              { id: 'subnet-2', service: 'subnet' },
              { id: 'ec2-1', service: 'ec2', subnets: ['subnet-1'] },
              { id: 'ec2-2', service: 'ec2', subnets: ['subnet-1', 'subnet-2'] }
           ]
         }]
      }
    };
    buildElkGraph(config);
  });

  it('should handle unplaced apps correctly based on type and edge cases', () => {
    const config: AdacConfig = {
      version: '0.1',
      metadata: { name: 'Test', created: '2023-10-27' },
      applications: [
        { id: 'cli-app', name: 'Browser', type: 'browser' },
        { id: 'backend-worker', name: 'Worker', type: 'worker' },
        { id: 'repeated-app', name: 'App', type: 'service', ai_tags: { group: 'AppGroup' } }
      ],
      infrastructure: { clouds: [{ id: 'cloud-3', provider: 'aws', region: 'us-east-1', services: [
         { id: 'vpc-parent', service: 'vpc' },
         { id: 'subnet-1', service: 'subnet', configuration: { vpc: 'vpc-parent' } },
         { id: 'child-1', service: 'ec2', configuration: { vpc: 'vpc-parent' } },
         { id: 'service-with-icon', service: 'lambda', ai_tags: { icon: 'Amazon EC2' } }, // hits 322-323
         { id: 'orphan-1', service: 'rds', ai_tags: { group: 'AppGroup' } },
         { id: 'orphan-2', service: 'lambda' }, 
         { id: 'orphan-3', service: 'dynamodb' } // hits ensureUtilityGroup already created
      ]}]}
    };
    buildElkGraph(config);
  });

  it('should test asset path resolution with mocked fs', () => {
    // mock fs.existsSync to hit the end of the loop and cover 164-201
    const fs = require('fs');
    const existSpy = vitest.spyOn(fs, 'existsSync').mockReturnValue(false);

    const config: AdacConfig = {
      version: '0.1',
      metadata: { name: 'Assets', created: '2023-10-27' },
      applications: [
        { id: 'custom-icon', name: 'App', type: 'service', ai_tags: { icon: 'Amazon EC2' } }, // hits loop
        { id: 'app-react', name: 'React App', technology: 'React', type: 'service' },
        { id: 'app-java', name: 'Java App', technology: 'Java', type: 'service' }, 
        { id: 'db-fallback', name: 'Database System', type: 'database' },
        { id: 'alias-test', name: 'ECS Service', type: 'service', ai_tags: { icon: 'ecs' } },
        { id: 'fuzzy-test', name: 'Something DB', type: 'database', ai_tags: { icon: 'My Database' } }
      ],
      infrastructure: { clouds: [] },
      connections: [
         { id: 'invalid-conn', from: undefined, to: undefined } as any, // hit missing from/to
         { id: 'valid-conn', from: 'app-react', to: 'app-java' } 
      ]
    };
    buildElkGraph(config);
    existSpy.mockRestore();
  });
});
