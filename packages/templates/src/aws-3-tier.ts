import type { AdacConfig } from '@mindfiredigital/adac-schema';

export const aws3TierWeb: AdacConfig = {
  version: '0.1',
  metadata: {
    name: 'AWS 3-Tier Web Architecture',
    created: new Date().toISOString(),
    description:
      'A classic 3-tier architecture with ALB, EC2, RDS, and ElastiCache',
  },
  infrastructure: {
    clouds: [
      {
        id: 'cloud-aws',
        provider: 'aws',
        region: 'us-east-1',
        services: [
          {
            id: 'alb-main',
            service: 'alb',
            type: 'networking',
            name: 'Application Load Balancer',
            description: 'Routes traffic to web tier',
            availability_zones: ['us-east-1a', 'us-east-1b'],
          },
          {
            id: 'ec2-web',
            service: 'ec2',
            type: 'compute',
            name: 'Web Tier',
            description: 'Auto-scaling EC2 instances for web frontend',
            availability_zones: ['us-east-1a', 'us-east-1b'],
            configuration: {
              instance_type: 't3.micro',
              auto_scaling: true,
              min_capacity: 2,
              max_capacity: 4,
            },
            cost: {
              quantity: 2,
              unit: 'instances',
            },
          },
          {
            id: 'ec2-app',
            service: 'ec2',
            type: 'compute',
            name: 'Application Tier',
            description: 'Backend application logic',
            availability_zones: ['us-east-1a', 'us-east-1b'],
            configuration: {
              instance_type: 't3.medium',
              auto_scaling: true,
              min_capacity: 2,
              max_capacity: 6,
            },
            cost: {
              quantity: 2,
              unit: 'instances',
            },
          },
          {
            id: 'rds-db',
            service: 'rds',
            type: 'database',
            name: 'Database Tier',
            description: 'Primary relational database (Multi-AZ)',
            availability_zones: ['us-east-1a', 'us-east-1b'],
            configuration: {
              engine: 'postgres',
              instance_class: 'db.r6g.large',
              multi_az: true,
              storage_gb: 100,
              backup_retention_period: 7,
            },
            cost: {
              quantity: 1,
              unit: 'instances',
            },
          },
          {
            id: 'elasticache-redis',
            service: 'elasticache',
            type: 'database',
            name: 'Caching Layer',
            description: 'Session store and query cache',
            availability_zones: ['us-east-1a', 'us-east-1b'],
            configuration: {
              engine: 'redis',
              node_type: 'cache.t3.small',
              num_cache_nodes: 2,
            },
            cost: {
              quantity: 2,
              unit: 'nodes',
            },
          },
        ],
      },
    ],
  },
  connections: [
    {
      id: 'conn-alb-web',
      from: 'alb-main',
      to: 'ec2-web',
      type: 'load-balancing',
    },
    {
      id: 'conn-web-app',
      from: 'ec2-web',
      to: 'ec2-app',
      type: 'api',
    },
    {
      id: 'conn-app-db',
      from: 'ec2-app',
      to: 'rds-db',
      type: 'database',
    },
    {
      id: 'conn-app-cache',
      from: 'ec2-app',
      to: 'elasticache-redis',
      type: 'database',
    },
  ],
};
