import { jest } from '@jest/globals';
// import fs from 'fs'; 
// We don't import fs directly, we mock it.
import * as path from 'path';
import { AdacConfig } from '@mindfiredigital/adac-schema';

const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();

jest.mock('fs', () => ({
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    default: {
        existsSync: mockExistsSync,
        readFileSync: mockReadFileSync,
    }
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
  dirname: jest.fn(() => '/mock/dirname'),
  extname: (p: string) => { const parts = p.split('.'); return parts.length > 1 ? '.' + parts.pop() : ''; },
  basename: (p: string) => p.split('/').pop(),
}));

describe('ElkBuilder Complete Tests', () => {
  let buildElkGraph: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{}');
  });

  const loadBuilder = () => require('../src/elkBuilder').buildElkGraph;

  // Helper to find node recursively
  const findNode = (id: string, nodes: any[]): any => {
      for (const n of nodes) {
          if (n.id === id) return n;
          if (n.children) {
              const found = findNode(id, n.children);
              if (found) return found;
          }
      }
      return null;
  };

  it('should fallback to dist mappings if src missing', () => {
    mockExistsSync.mockImplementation((p: any) => {
        const pathStr = p.toString();
        // Simulate missing src mapping, present dist mapping
        if (pathStr.includes('src/mappings')) return false; 
        if (pathStr.includes('mappings/icon-map.json')) return true;
        // Asset existence check for resolveAssetPath
        if (pathStr.includes('dist.png')) return true;
        return false;
    });
    mockReadFileSync.mockReturnValue('{"dist": "dist.png"}');
    
    buildElkGraph = loadBuilder();
    
    const config: AdacConfig = {
        applications: [],
        infrastructure: { clouds: [{
            provider: 'aws',
            services: [{ id: 's1', type: 'dist', name: 's1' }]
        }]}
    };
    
    const graph = buildElkGraph(config);
    const node = findNode('s1', graph.children);
    expect(node).toBeDefined();
    // Verify icon path resolution was attempted
    // If resolved, it should be an absolute path (mocked join)
    expect(node.properties.iconPath).toBeDefined();
  });

  it('should handle icon map load failure gracefully', () => {
      // Ensure exists check passes so read is attempted
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid-json'); // Trigger JSON parse error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      loadBuilder();
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load icon-map.json', expect.anything());
  });

  it('should resolve icons using fuzzy lookup', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({
          'Amazon Simple Storage Service (Amazon S3)': 's3.png',
          'Database': 'db.png'
      }));
      buildElkGraph = loadBuilder();
      
      const config: AdacConfig = {
          applications: [],
          infrastructure: { clouds: [{
              provider: 'aws',
              services: [
                  { id: 'bucket', type: 's3', name: 'bucket' }, // Matches alias/fuzzy
                  { id: 'mydb', type: 'custom-database', name: 'db' } // Matches 'database' fallback
              ]
          }]}
      };
      
      const graph = buildElkGraph(config);
      const s3 = findNode('bucket', graph.children);
      const db = findNode('mydb', graph.children);
      
      // We expect 's3' to resolve via Alias or fuzzy
      expect(s3).toBeDefined();
      expect(s3.properties.iconPath).toBeDefined();
      expect(db).toBeDefined();
      expect(db.properties.iconPath).toBeDefined();
  });
  
  it('should detect app icons based on technology', () => {
       mockReadFileSync.mockReturnValue(JSON.stringify({
          'Front-End Web & Mobile': 'react.png',
          'Compute': 'node.png'
       }));
       buildElkGraph = loadBuilder();
       
       const config: AdacConfig = {
           infrastructure: { clouds: [] }, 
           applications: [
               { id: 'app1', name: 'frontend', technology: 'React Native', type: 'mobile' },
               { id: 'app2', name: 'backend', technology: 'Node.js', type: 'service' }
           ]
       };
       
       const graph = buildElkGraph(config);
       
       const app1 = findNode('app1', graph.children);
       const app2 = findNode('app2', graph.children);
       
       expect(app1).toBeDefined();
       expect(app2).toBeDefined();
       expect(app1.properties.iconPath).toContain('react.png');
       expect(app2.properties.iconPath).toContain('node.png');
  });

  it('should place services in VPC and Subnet hierarchy', () => {
      buildElkGraph = loadBuilder();
      const config: AdacConfig = {
          applications: [], 
          infrastructure: { clouds: [{
              provider: 'aws',
              services: [
                  { id: 'vpc1', type: 'vpc', name: 'Main VPC' },
                  { id: 'sub1', type: 'subnet', config: { vpc: 'vpc1', availability_zone: 'a' } },
                  { id: 'ec2', type: 'ec2', config: { subnets: ['sub1'] } }
              ]
          }]}
      };
      
      const graph = buildElkGraph(config);
      // Hierarchy: vpc1 -> vpc1-a (AZ) -> sub1 -> ec2
      const vpc = findNode('vpc1', graph.children);
      expect(vpc).toBeDefined();
      
      // AZ inside VPC
      const az = findNode('vpc1-a', vpc.children);
      expect(az).toBeDefined();
      expect(az.properties.cssClass).toBe('aws-az');
      
      // Subnet inside AZ
      const sub = findNode('sub1', az.children);
      expect(sub).toBeDefined();
      
      // EC2 inside Subnet
      const ec2 = findNode('ec2', sub.children);
      expect(ec2).toBeDefined();
  });

  it('should create implicit nodes for external connections', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({
          'Internet': 'internet.png',
          'User': 'user.png'
      }));
      buildElkGraph = loadBuilder();
      
      const config: AdacConfig = {
          infrastructure: { clouds: [] }, 
          connections: [
              { from: 'unknown-user', to: 'known-app', type: 'https' }
          ],
          applications: [{ id: 'known-app', name: 'App', type: 'app' }]
      };
      
      const graph = buildElkGraph(config);
      const userNode = findNode('unknown-user', graph.children);
      expect(userNode).toBeDefined();
      expect(userNode.properties.iconPath).toContain('user.png'); 
      
      const edge = graph.edges.find((e: any) => e.sources.includes('unknown-user'));
      expect(edge).toBeDefined();
  });
});
