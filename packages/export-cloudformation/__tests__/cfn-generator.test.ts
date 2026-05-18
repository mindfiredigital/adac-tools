import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  generateCloudFormationFromAdacContent,
  generateCloudFormationFromAdacFile,
  generateCloudFormationFromServices,
} from '../src/cfn-generator.js';

const TEST_DIR = fileURLToPath(new URL('.', import.meta.url));
const YAMLS_DIR = resolve(join(TEST_DIR, '../../../yamls'));

describe('generateCloudFormationFromServices', () => {
  it('generates an AWS EC2 template with parameters', () => {
    const result = generateCloudFormationFromServices([
      {
        id: 'web-server',
        type: 'compute',
        subtype: 'ec2',
        cloud: 'aws',
        config: { instance_class: 't3.micro' },
      },
    ]);

    expect(result.templateYaml).toContain(
      'AWSTemplateFormatVersion: "2010-09-09"'
    );
    expect(result.templateYaml).toContain('WebServerImageId:');
    expect(result.templateYaml).toContain('Type: "AWS::EC2::Instance"');
    expect(result.templateYaml).toContain('InstanceType:');
  });

  it('serializes template descriptions as YAML-safe scalars', () => {
    const result = generateCloudFormationFromServices([], {
      region: 'us-east-1 "quoted" \\ path',
    });

    expect(result.templateYaml).toContain(
      'Description: "Generated CloudFormation template for aws (us-east-1 \\"quoted\\" \\\\ path)"'
    );
  });

  it('generates a DynamoDB table from services', () => {
    const result = generateCloudFormationFromServices([
      {
        id: 'sessions-table',
        type: 'database',
        subtype: 'dynamodb',
        cloud: 'aws',
        config: {
          billing_mode: 'PAY_PER_REQUEST',
          hash_key: 'pk',
          range_key: 'sk',
          attributes: [
            { name: 'pk', type: 'S' },
            { name: 'sk', type: 'S' },
          ],
        },
      },
    ]);

    expect(result.templateYaml).toContain('SessionsTable:');
    expect(result.templateYaml).toContain('Type: "AWS::DynamoDB::Table"');
    expect(result.templateYaml).toContain('BillingMode: "PAY_PER_REQUEST"');
    expect(result.templateYaml).toContain('AttributeName: "pk"');
    expect(result.templateYaml).toContain('AttributeName: "sk"');
  });

  it('emits diagnostics when an RDS subnet group has fewer than two AZs', () => {
    const result = generateCloudFormationFromServices([
      {
        id: 'private-subnet-a',
        type: 'networking',
        subtype: 'subnet',
        cloud: 'aws',
        config: { availability_zone: 'us-east-1a', vpc: 'main-vpc' },
      },
      {
        id: 'orders-db',
        type: 'database',
        subtype: 'rds-postgres',
        cloud: 'aws',
        config: { subnets: ['private-subnet-a'] },
      },
    ]);

    expect(result.templateYaml).toContain('OrdersDbSubnetGroup:');
    expect(result.diagnostics).toContain(
      'RDS service "orders-db" DBSubnetGroup has fewer than 2 distinct Availability Zones for subnets: PrivateSubnetA.'
    );
  });

  it('throws when a subnet is missing cfg.vpc', () => {
    expect(() =>
      generateCloudFormationFromServices([
        {
          id: 'public-subnet-a',
          type: 'networking',
          subtype: 'subnet',
          cloud: 'aws',
          config: { availability_zone: 'us-east-1a' },
        },
      ])
    ).toThrow('Missing required cfg.vpc for Subnet public-subnet-a.');
  });

  it('omits explicit physical names for ALB resources', () => {
    const result = generateCloudFormationFromServices([
      {
        id: 'app-alb',
        type: 'networking',
        subtype: 'application-load-balancer',
        cloud: 'aws',
        config: {
          subnets: ['public-subnet-a', 'public-subnet-b'],
          security_groups: ['alb-sg'],
        },
      },
    ]);

    expect(result.templateYaml).toContain('AppAlb:');
    expect(result.templateYaml).toContain(
      'Type: "AWS::ElasticLoadBalancingV2::LoadBalancer"'
    );
    expect(result.templateYaml).not.toContain('Name: "app-alb"');
  });

  it('throws when mappers emit duplicate logical IDs', () => {
    expect(() =>
      generateCloudFormationFromServices([
        {
          id: 'shared-service',
          type: 'networking',
          subtype: 'vpc',
          cloud: 'aws',
        },
        {
          id: 'shared-service',
          type: 'compute',
          subtype: 'lambda',
          cloud: 'aws',
          config: {
            handler_source:
              'exports.handler = async () => ({ statusCode: 200 });',
          },
        },
      ])
    ).toThrow(
      'Duplicate CloudFormation resources key "SharedService" emitted by mapComputeServices; already emitted by mapNetworkingServices.'
    );
  });

  it('emits diagnostics for unsupported services', () => {
    const result = generateCloudFormationFromServices([
      {
        id: 'edge-cache',
        type: 'cdn',
        subtype: 'cloudfront',
        cloud: 'aws',
      },
    ]);

    expect(result.diagnostics).toContain(
      'Unsupported CloudFormation service "edge-cache" with type "cdn" and subtype "cloudfront" was not mapped.'
    );
  });

  it('serializes multiline strings as YAML block scalars', () => {
    const result = generateCloudFormationFromServices([
      {
        id: 'web-server',
        type: 'compute',
        subtype: 'ec2',
        cloud: 'aws',
        config: { instance_class: 't3.micro\nwith-note' },
      },
    ]);

    expect(result.templateYaml).toContain(
      'Default: |\n      t3.micro\n      with-note'
    );
    expect(result.templateYaml).not.toContain('t3.micro\\nwith-note');
  });

  it('throws when an ECS Fargate container is missing an image', () => {
    expect(() =>
      generateCloudFormationFromServices([
        {
          id: 'api-service',
          type: 'compute',
          subtype: 'ecs-fargate',
          cloud: 'aws',
          config: {
            containers: [{ name: 'api', port: 3000 }],
          },
        },
      ])
    ).toThrow(
      'ECS Fargate service "api-service" container "api" at index 0 is missing a required image.'
    );
  });

  it('uses AWS account pseudo-parameter for ECS execution role ARN', () => {
    const result = generateCloudFormationFromServices([
      {
        id: 'api-service',
        type: 'compute',
        subtype: 'ecs-fargate',
        cloud: 'aws',
        config: {
          containers: [
            {
              name: 'api',
              image: '123456789012.dkr.ecr.us-east-1.amazonaws.com/api:latest',
              port: 3000,
            },
          ],
        },
      },
    ]);

    expect(result.templateYaml).toContain(
      'Fn::Sub: "arn:aws:iam::${AWS::AccountId}:role/ecsTaskExecutionRole"'
    );
    expect(result.templateYaml).not.toContain(
      'arn:aws:iam::123456789012:role/ecsTaskExecutionRole'
    );
  });

  it('outputs the ECS cluster ARN attribute', () => {
    const result = generateCloudFormationFromServices([
      {
        id: 'api-service',
        type: 'compute',
        subtype: 'ecs-fargate',
        cloud: 'aws',
        config: {
          containers: [
            {
              name: 'api',
              image: '123456789012.dkr.ecr.us-east-1.amazonaws.com/api:latest',
            },
          ],
        },
      },
    ]);

    expect(result.templateYaml).toContain('ApiServiceClusterArn:');
    expect(result.templateYaml).toContain(
      'Fn::GetAtt:\n        - "ApiServiceCluster"\n        - "Arn"'
    );
  });

  it('throws when a Lambda function is missing explicit code', () => {
    expect(() =>
      generateCloudFormationFromServices([
        {
          id: 'thumb-fn',
          type: 'compute',
          subtype: 'lambda',
          cloud: 'aws',
          config: { handler: 'index.handler' },
        },
      ])
    ).toThrow(
      'Lambda service "thumb-fn" requires explicit code via config.code, config.handler_source, config.code_uri, or config.s3_bucket/config.s3_key.'
    );
  });
});

describe('generateCloudFormationFromAdacFile', () => {
  it('generates AWS networking and ECS resources from aws.adac.yaml', () => {
    const result = generateCloudFormationFromAdacFile(
      join(YAMLS_DIR, 'aws.adac.yaml')
    );

    expect(result.templateYaml).toContain('VpcMain:');
    expect(result.templateYaml).toContain('Type: "AWS::EC2::VPC"');
    expect(result.templateYaml).toContain('PublicSubnetA:');
    expect(result.templateYaml).toContain('Alb:');
    expect(result.templateYaml).toContain(
      'Type: "AWS::ElasticLoadBalancingV2::LoadBalancer"'
    );
    expect(result.templateYaml).toContain('EcsServiceCluster:');
    expect(result.templateYaml).toContain('Type: "AWS::ECS::Cluster"');
    expect(result.templateYaml).toContain('EcsServiceService:');
    expect(result.templateYaml).toContain('Type: "AWS::ECS::Service"');
    expect(result.templateYaml).toContain('RdsPostgres:');
    expect(result.templateYaml).toContain('Type: "AWS::RDS::DBInstance"');
    expect(result.templateYaml).toContain('ManageMasterUserPassword: true');
  });
});

describe('generateCloudFormationFromAdacContent', () => {
  it('normalizes YAML content using config and service fallback', () => {
    const yamlContent = `
version: '0.1'
metadata:
  name: 'CloudFormation Example'
  created: '2026-03-26'
infrastructure:
  clouds:
    - id: 'aws-primary'
      provider: 'aws'
      region: 'us-east-1'
      services:
        - id: 'thumb-fn'
          service: 'lambda'
          config:
            handler: 'index.handler'
            handler_source: |
              exports.handler = async () => ({ statusCode: 200 });
`;

    const result = generateCloudFormationFromAdacContent(yamlContent);

    expect(result.templateYaml).toContain('ThumbFn:');
    expect(result.templateYaml).toContain('Type: "AWS::Lambda::Function"');
    expect(result.templateYaml).toContain('ZipFile: |');
    expect(result.templateYaml).toContain(
      'exports.handler = async () => ({ statusCode: 200 });'
    );
  });

  it('emits diagnostics for unsupported ADAC service names', () => {
    const yamlContent = `
version: '0.1'
metadata:
  name: 'Unsupported Service Example'
infrastructure:
  clouds:
    - id: 'aws-primary'
      provider: 'aws'
      region: 'us-east-1'
      services:
        - id: 'edge-cache'
          service: 'cloudfront'
        - id: 'untyped-node'
`;

    const result = generateCloudFormationFromAdacContent(yamlContent, {
      validate: false,
    });

    expect(result.diagnostics).toContain(
      'Unsupported CloudFormation service "edge-cache" with type "cloudfront" and subtype "none" was not mapped.'
    );
    expect(result.diagnostics).toContain(
      'Unsupported CloudFormation service "untyped-node" with type "unknown" and subtype "none" was not mapped.'
    );
  });

  it('throws when a requested cloudId is not found', () => {
    const yamlContent = `
version: '0.1'
metadata:
  name: 'Cloud Selection Example'
infrastructure:
  clouds:
    - id: 'aws-primary'
      provider: 'aws'
      region: 'us-east-1'
      services: []
    - id: 'aws-secondary'
      provider: 'aws'
      region: 'us-west-2'
      services: []
`;

    expect(() =>
      generateCloudFormationFromAdacContent(yamlContent, {
        cloudId: 'aws-missing',
        validate: false,
      })
    ).toThrow(
      'Cloud "aws-missing" was not found in ADAC config. Available clouds: aws-primary, aws-secondary.'
    );
  });
});
