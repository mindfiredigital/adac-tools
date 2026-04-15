import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import {
  generateCloudFormationFromAdacContent,
  generateCloudFormationFromAdacFile,
  generateCloudFormationFromServices,
} from '../src/cfn-generator.js';

const YAMLS_DIR = resolve(join(import.meta.dirname, '../../../yamls'));

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

    expect(result.templateYaml).toContain('AWSTemplateFormatVersion: "2010-09-09"');
    expect(result.templateYaml).toContain('WebServerImageId:');
    expect(result.templateYaml).toContain('Type: "AWS::EC2::Instance"');
    expect(result.templateYaml).toContain('InstanceType:');
  });

  it('generates AWS networking and ECS resources from aws.adac.yaml', () => {
    const result = generateCloudFormationFromAdacFile(join(YAMLS_DIR, 'aws.adac.yaml'));

    expect(result.templateYaml).toContain('VpcMain:');
    expect(result.templateYaml).toContain('Type: "AWS::EC2::VPC"');
    expect(result.templateYaml).toContain('PublicSubnetA:');
    expect(result.templateYaml).toContain('Alb:');
    expect(result.templateYaml).toContain('Type: "AWS::ElasticLoadBalancingV2::LoadBalancer"');
    expect(result.templateYaml).toContain('EcsServiceCluster:');
    expect(result.templateYaml).toContain('Type: "AWS::ECS::Cluster"');
    expect(result.templateYaml).toContain('EcsServiceService:');
    expect(result.templateYaml).toContain('Type: "AWS::ECS::Service"');
    expect(result.templateYaml).toContain('RdsPostgres:');
    expect(result.templateYaml).toContain('Type: "AWS::RDS::DBInstance"');
    expect(result.templateYaml).toContain('ManageMasterUserPassword: true');
  });

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
`;

    const result = generateCloudFormationFromAdacContent(yamlContent);

    expect(result.templateYaml).toContain('ThumbFn:');
    expect(result.templateYaml).toContain('Type: "AWS::Lambda::Function"');
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

  it('validates generated template with cfn-lint when available', () => {
    let hasCfnLint = false;
    try {
      const versionCheck = spawnSync('cfn-lint', ['--version'], {
        encoding: 'utf8',
      });
      hasCfnLint = versionCheck.status === 0;
    } catch {
      hasCfnLint = false;
    }

    if (!hasCfnLint) {
      console.warn('Skipping cfn-lint validation as the tool is not available');
      return;
    }

    const result = generateCloudFormationFromAdacFile(join(YAMLS_DIR, 'aws.adac.yaml'));
    const tempDir = mkdtempSync(join(tmpdir(), 'adac-cfn-'));
    const templatePath = join(tempDir, 'template.yaml');

    writeFileSync(templatePath, result.templateYaml);

    const validation = spawnSync('cfn-lint', [templatePath], {
      encoding: 'utf8',
    });

    expect(validation.status).toBe(0);
  });
});
