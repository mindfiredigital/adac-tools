import type { AdacConfig } from '@mindfiredigital/adac-schema';

export const awsServerlessApi: AdacConfig = {
  version: '0.1',
  metadata: {
    name: 'AWS Serverless API',
    created: new Date().toISOString(),
    description:
      'A completely serverless REST API using API Gateway, Lambda, DynamoDB, and S3.',
  },
  infrastructure: {
    clouds: [
      {
        id: 'cloud-aws',
        provider: 'aws',
        region: 'us-west-2',
        services: [
          {
            id: 'api-gw',
            service: 'api-gateway',
            type: 'networking',
            name: 'API Gateway',
            description: 'RESTful API endpoint',
          },
          {
            id: 'lambda-auth',
            service: 'lambda',
            type: 'compute',
            name: 'Auth Lambda',
            description: 'Custom authorizer',
            configuration: {
              memory_mb: 128,
              timeout_sec: 5,
            },
            cost: {
              quantity: 1000000,
              unit: 'requests',
            },
          },
          {
            id: 'lambda-api',
            service: 'lambda',
            type: 'compute',
            name: 'API Handler',
            description: 'Main business logic',
            configuration: {
              memory_mb: 512,
              timeout_sec: 30,
            },
            cost: {
              quantity: 5000000,
              unit: 'requests',
            },
          },
          {
            id: 'dynamodb-users',
            service: 'dynamodb',
            type: 'database',
            name: 'Users Table',
            description: 'NoSQL user data store',
            configuration: {
              billing_mode: 'PAY_PER_REQUEST',
            },
            cost: {
              quantity: 10,
              unit: 'gb',
            },
          },
          {
            id: 's3-assets',
            service: 's3',
            type: 'storage',
            name: 'Static Assets',
            description: 'Images and user uploads',
            configuration: {
              storage_class: 'STANDARD',
            },
            cost: {
              quantity: 50,
              unit: 'gb',
            },
          },
        ],
      },
    ],
  },
  connections: [
    {
      id: 'conn-gw-auth',
      from: 'api-gw',
      to: 'lambda-auth',
      type: 'auth',
    },
    {
      id: 'conn-gw-api',
      from: 'api-gw',
      to: 'lambda-api',
      type: 'api',
    },
    {
      id: 'conn-api-db',
      from: 'lambda-api',
      to: 'dynamodb-users',
      type: 'database',
    },
    {
      id: 'conn-api-s3',
      from: 'lambda-api',
      to: 's3-assets',
      type: 'storage',
    },
  ],
};
