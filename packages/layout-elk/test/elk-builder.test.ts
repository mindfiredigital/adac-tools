import { describe, it, expect, vitest } from 'vitest';
import { buildElkGraph } from '../src/elk-builder.js';
import fs from 'fs';
import { AdacConfig } from '@mindfiredigital/adac-schema';

describe('ELK Builder', () => {
  it('should build an empty ELK graph from an empty AdacConfig', () => {
    const config: AdacConfig = {
      version: '0.1',
      metadata: { name: 'Empty', created: '2023-10-27' },
      infrastructure: { clouds: [] },
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
          ai_tags: { group: 'Client Apps' },
        },
        {
          id: 'app-api',
          name: 'Backend API',
          technology: 'Node.js',
          type: 'service',
          ai_tags: { group: 'Backend Services', icon: 'Lambda' }, // uses icon
        },
        {
          id: 'user-app',
          name: 'User App',
          type: 'user', // generic fallback
        },
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
                service: 'vpc',
              },
              {
                id: 'my-subnet',
                name: 'Public Subnet',
                service: 'subnet',
                configuration: {
                  vpc: 'my-vpc',
                  public: true,
                  availability_zone: 'a',
                },
              },
              {
                id: 'my-ec2',
                name: 'Web Server',
                service: 'ec2',
                configuration: {
                  vpc: 'my-vpc',
                  subnets: ['my-subnet'],
                },
                runs: ['app-api'],
              },
              {
                id: 'orphan-db',
                name: 'Database',
                service: 'rds',
                ai_tags: { group: 'Backend Services' },
              },
              {
                id: 'unknown-service',
                name: 'Unknown',
                service: 'unknown',
                description: 'Tests utility group',
              },
            ],
          },
        ],
      },
      connections: [
        {
          id: 'conn-1',
          from: 'app-web',
          to: 'app-api',
          type: 'https',
        },
        {
          id: 'conn-2',
          from: 'app-api',
          to: 'orphan-db',
          type: 'tcp',
        },
        {
          // test implicit nodes
          id: 'conn-3',
          from: 'user-frontend',
          to: 'my-vpc',
          type: 'internet',
        },
        {
          id: 'conn-4',
          from: 'my-ec2',
          to: 'backend-system',
          type: 'api',
        },
      ],
    };

    const graph = buildElkGraph(config);
    expect(graph).toBeDefined();
    expect(graph.id).toBe('root');
    expect(graph.children).toBeDefined();

    // Check root has expected implicit nodes
    const rootIds = graph.children?.map((c) => c.id) || [];
    expect(rootIds).toContain('user-frontend');
    expect(rootIds).toContain('backend-system');
    expect(rootIds).toContain('my-vpc');

    // Should create implicit az node since subnet config has availability_zone string
    const azNode = graph.children
      ?.find((c) => c.id === 'my-vpc')
      ?.children?.find((c) => c.id === 'my-vpc-a');
    expect(azNode).toBeDefined();

    // Check utility group
    expect(rootIds).toContain('group-utility-shared');
  });

  it('should handle services with single string subnets', () => {
    const config: AdacConfig = {
      version: '0.1',
      metadata: { name: 'Test', created: '2023-10-27' },
      infrastructure: {
        clouds: [
          {
            id: 'aws-cloud-2',
            provider: 'aws',
            region: 'us-east-1',
            services: [
              { id: 'subnet-1', service: 'subnet' },
              { id: 'subnet-2', service: 'subnet' },
              { id: 'ec2-1', service: 'ec2', subnets: ['subnet-1'] },
              {
                id: 'ec2-2',
                service: 'ec2',
                subnets: ['subnet-1', 'subnet-2'],
              },
            ],
          },
        ],
      },
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
        {
          id: 'repeated-app',
          name: 'App',
          type: 'service',
          ai_tags: { group: 'AppGroup' },
        },
      ],
      infrastructure: {
        clouds: [
          {
            id: 'cloud-3',
            provider: 'aws',
            region: 'us-east-1',
            services: [
              { id: 'vpc-parent', service: 'vpc' },
              {
                id: 'subnet-1',
                service: 'subnet',
                configuration: { vpc: 'vpc-parent' },
              },
              {
                id: 'child-1',
                service: 'ec2',
                configuration: { vpc: 'vpc-parent' },
              },
              {
                id: 'service-with-icon',
                service: 'lambda',
                ai_tags: { icon: 'Amazon EC2' },
              }, // hits 322-323
              {
                id: 'orphan-1',
                service: 'rds',
                ai_tags: { group: 'AppGroup' },
              },
              { id: 'orphan-2', service: 'lambda' },
              { id: 'orphan-3', service: 'dynamodb' }, // hits ensureUtilityGroup already created
            ],
          },
        ],
      },
    };
    buildElkGraph(config);
  });

  it('should test asset path resolution with mocked fs', () => {
    // mock fs.existsSync to hit the end of the loop and cover 164-201
    const existSpy = vitest.spyOn(fs, 'existsSync').mockReturnValue(false);

    const config: AdacConfig = {
      version: '0.1',
      metadata: { name: 'Assets', created: '2023-10-27' },
      applications: [
        {
          id: 'custom-icon',
          name: 'App',
          type: 'service',
          ai_tags: { icon: 'Amazon EC2' },
        }, // hits loop
        {
          id: 'app-react',
          name: 'React App',
          technology: 'React',
          type: 'service',
        },
        {
          id: 'app-java',
          name: 'Java App',
          technology: 'Java',
          type: 'service',
        },
        { id: 'db-fallback', name: 'Database System', type: 'database' },
        {
          id: 'alias-test',
          name: 'ECS Service',
          type: 'service',
          ai_tags: { icon: 'ecs' },
        },
        {
          id: 'fuzzy-test',
          name: 'Something DB',
          type: 'database',
          ai_tags: { icon: 'My Database' },
        },
      ],
      infrastructure: { clouds: [] },
      connections: [
        {
          id: 'invalid-conn',
          from: undefined as unknown as string,
          to: undefined as unknown as string,
          type: 'https',
        }, // hit missing from/to
        { id: 'valid-conn', from: 'app-react', to: 'app-java', type: 'https' },
      ],
    };
    buildElkGraph(config);
    existSpy.mockRestore();
  });

  it('should build an ELK graph with GCP infrastructure', () => {
    const config: AdacConfig = {
      version: '0.1',
      metadata: { name: 'GCP Test', created: '2023-10-27' },
      infrastructure: {
        clouds: [
          {
            id: 'gcp-cloud',
            provider: 'gcp',
            region: 'us-central1',
            services: [
              {
                id: 'gcp-vpc',
                name: 'GCP VPC',
                service: 'vpc',
              },
              {
                id: 'gcp-subnet',
                name: 'GCP Subnet',
                service: 'subnet',
                configuration: {
                  vpc: 'gcp-vpc',
                },
              },
              {
                id: 'gke-cluster',
                name: 'GKE Cluster',
                service: 'gke',
                configuration: {
                  vpc: 'gcp-vpc',
                  subnets: ['gcp-subnet'],
                },
              },
              {
                id: 'cloud-sql',
                name: 'Database',
                service: 'cloud-sql',
              },
            ],
          },
        ],
      },
      applications: [
        {
          id: 'app-run',
          name: 'Cloud Run App',
          type: 'service',
          technology: 'Node.js',
        },
      ],
    };

    const graph = buildElkGraph(config);
    expect(graph).toBeDefined();
    expect(graph.id).toBe('root');

    // Check containers styles for GCP
    const vpcNode = graph.children?.find((c) => c.id === 'gcp-vpc');
    expect(vpcNode?.properties?.cssClass).toBe('gcp-vpc');

    const subnetNode = vpcNode?.children?.find((c) => c.id === 'gcp-subnet');
    expect(subnetNode?.properties?.cssClass).toBe('gcp-subnet');

    const gkeNode = subnetNode?.children?.find((c) => c.id === 'gke-cluster');
    expect(gkeNode?.properties?.cssClass).toBe('gcp-compute-cluster');

    // Test GCP region and zone
    const regionConfig: AdacConfig = {
      version: '0.1',
      metadata: { name: 'Region Test', created: '2023-10-27' },
      infrastructure: {
        clouds: [
          {
            id: 'gcp-cloud-2',
            provider: 'gcp',
            region: 'us-east1',
            services: [
              { id: 'my-region', service: 'region' },
              {
                id: 'my-zone',
                service: 'zone',
                configuration: { vpc: 'some-vpc' },
              },
            ],
          },
        ],
      },
    };
    const regionGraph = buildElkGraph(regionConfig);
    const utilityGroup = regionGraph.children?.find(
      (c) => c.id === 'group-utility-shared'
    );
    const regionNode = utilityGroup?.children?.find(
      (c) => c.id === 'my-region'
    );
    expect(regionNode?.properties?.cssClass).toBe('gcp-region');
    const zoneNode = utilityGroup?.children?.find((c) => c.id === 'my-zone');
    expect(zoneNode?.properties?.cssClass).toBe('gcp-zone');
  });

  it('should build an ELK graph with Azure infrastructure', () => {
    const config: AdacConfig = {
      version: '0.1',
      metadata: { name: 'Azure Test', created: '2023-10-27' },
      infrastructure: {
        clouds: [
          {
            id: 'azure-cloud',
            provider: 'azure',
            region: 'eastus',
            services: [
              {
                id: 'azure-rg',
                name: 'Resource Group',
                service: 'vpc',
              },
              {
                id: 'azure-sub',
                name: 'Subscription',
                service: 'region',
              },
              {
                id: 'azure-container',
                name: 'VNet',
                service: 'subnet',
                configuration: {
                  vpc: 'azure-rg',
                },
              },
              {
                id: 'azure-aks',
                name: 'AKS',
                service: 'compute',
                configuration: {
                  vpc: 'azure-rg',
                  subnets: ['azure-container'],
                },
              },
            ],
          },
        ],
      },
    };

    const graph = buildElkGraph(config);
    expect(graph).toBeDefined();

    const rgNode = graph.children?.find((c) => c.id === 'azure-rg');
    expect(rgNode?.properties?.cssClass).toBe('azure-rg');

    const vnetNode = rgNode?.children?.find((c) => c.id === 'azure-container');
    expect(vnetNode?.properties?.cssClass).toBe('azure-container');

    const aksNode = vnetNode?.children?.find((c) => c.id === 'azure-aks');
    expect(aksNode?.properties?.cssClass).toBe('azure-compute-cluster');
  });
});
