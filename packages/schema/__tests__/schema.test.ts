import {
  AdacConfig,
  AdacApplication,
  AdacService,
  AdacCloud,
  AdacConnection,
} from '../src/index';

describe('Schema Interfaces', () => {
  describe('AdacApplication', () => {
    it('should allow creating a valid application object', () => {
      const app: AdacApplication = {
        id: 'app-1',
        name: 'Test App',
        type: 'web',
        technology: 'React',
        ai_tags: {
          icon: 'react-icon',
          group: 'frontend',
          description: 'A React application',
        },
      };

      expect(app.id).toBe('app-1');
      expect(app.name).toBe('Test App');
      expect(app.type).toBe('web');
      expect(app.technology).toBe('React');
      expect(app.ai_tags?.icon).toBe('react-icon');
    });

    it('should allow minimal application object', () => {
      const app: AdacApplication = {
        id: 'app-2',
        name: 'Minimal App',
        type: 'api',
      };

      expect(app.id).toBe('app-2');
      expect(app.technology).toBeUndefined();
      expect(app.ai_tags).toBeUndefined();
    });
  });

  describe('AdacService', () => {
    it('should allow creating a valid service object', () => {
      const service: AdacService = {
        id: 'service-1',
        type: 'AWS::EC2::Instance',
        subtype: 't2.micro',
        runs: ['app-1'],
        name: 'Web Server',
        description: 'Production web server',
        subnets: ['subnet-1'],
        config: { key: 'value' },
        configuration: { setting: 'enabled' },
        ai_tags: {
          icon: 'ec2-icon',
          group: 'compute',
          description: 'EC2 instance',
        },
      };

      expect(service.id).toBe('service-1');
      expect(service.type).toBe('AWS::EC2::Instance');
      expect(service.runs).toEqual(['app-1']);
    });

    it('should allow minimal service object', () => {
      const service: AdacService = {
        id: 'service-2',
        type: 'AWS::S3::Bucket',
      };

      expect(service.id).toBe('service-2');
      expect(service.name).toBeUndefined();
      expect(service.runs).toBeUndefined();
    });
  });

  describe('AdacCloud', () => {
    it('should allow creating a valid cloud object', () => {
      const cloud: AdacCloud = {
        provider: 'aws',
        services: [
          {
            id: 's1',
            type: 'AWS::EC2::Instance',
          },
        ],
      };

      expect(cloud.provider).toBe('aws');
      expect(cloud.services).toHaveLength(1);
    });

    it('should allow empty services array', () => {
      const cloud: AdacCloud = {
        provider: 'azure',
        services: [],
      };

      expect(cloud.services).toHaveLength(0);
    });
  });

  describe('AdacConnection', () => {
    it('should allow creating a connection with from/to', () => {
      const conn: AdacConnection = {
        id: 'conn-1',
        from: 'app-1',
        to: 'service-1',
        type: 'http',
      };

      expect(conn.from).toBe('app-1');
      expect(conn.to).toBe('service-1');
    });

    it('should allow creating a connection with source/target', () => {
      const conn: AdacConnection = {
        from: 'app-1',
        to: 'service-1',
        source: 'app-1',
        target: 'service-1',
        type: 'grpc',
      };

      expect(conn.source).toBe('app-1');
      expect(conn.target).toBe('service-1');
    });

    it('should allow connection without id', () => {
      const conn: AdacConnection = {
        from: 'a',
        to: 'b',
        type: 'tcp',
      };

      expect(conn.id).toBeUndefined();
    });
  });

  describe('AdacConfig', () => {
    it('should allow creating a complete config', () => {
      const config: AdacConfig = {
        applications: [
          {
            id: 'app-1',
            name: 'My App',
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
        layout: 'elk',
      };

      expect(config.applications).toHaveLength(1);
      expect(config.infrastructure.clouds).toHaveLength(1);
      expect(config.connections).toHaveLength(1);
      expect(config.layout).toBe('elk');
    });

    it('should allow minimal config', () => {
      const config: AdacConfig = {
        applications: [],
        infrastructure: {
          clouds: [],
        },
      };

      expect(config.applications).toHaveLength(0);
      expect(config.connections).toBeUndefined();
      expect(config.layout).toBeUndefined();
    });

    it('should allow config with dagre layout', () => {
      const config: AdacConfig = {
        applications: [],
        infrastructure: {
          clouds: [],
        },
        layout: 'dagre',
      };

      expect(config.layout).toBe('dagre');
    });
  });
});
