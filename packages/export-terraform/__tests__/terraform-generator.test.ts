import { mkdtempSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { describe, expect, it } from 'vitest';
import { generateTerraformFromAdacFile } from '../src/terraform-generator.js';

const YAMLS_DIR = resolve(join(import.meta.dirname, '../../../yamls'));
const TEMP_DIR_PREFIX = join(tmpdir(), 'adac-export-terraform-');

function hasTerraformCli(): boolean {
  try {
    execFileSync('terraform', ['version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function generateTerraformFromYaml(
  yamlContent: string,
  fileName: string,
  options?: Parameters<typeof generateTerraformFromAdacFile>[1]
) {
  const tempDir = mkdtempSync(TEMP_DIR_PREFIX);
  const filePath = join(tempDir, fileName);
  writeFileSync(filePath, yamlContent);
  return generateTerraformFromAdacFile(filePath, {
    validate: false,
    ...options,
  });
}

describe('generateTerraformFromAdacFile', () => {
  it('generates provider and EC2 resource', () => {
    const result = generateTerraformFromYaml(
      `
version: '0.1'
metadata:
  name: 'EC2 Test'
infrastructure:
  clouds:
    - id: 'aws-primary'
      provider: 'aws'
      region: 'us-east-1'
      services:
        - id: 'web_server'
          type: 'compute'
          subtype: 'ec2'
          config:
            instance_class: 't3.micro'
`,
      'ec2-test.adac.yaml'
    );

    expect(result.mainTf).toContain('provider "aws"');
    expect(result.mainTf).toContain('resource "aws_instance" "web_server"');
    expect(result.mainTf).toContain('ami           = var.web_server_ami');
    expect(result.mainTf).toContain(
      'instance_type = var.web_server_instance_type'
    );
    expect(result.variablesTf).toContain('variable "web_server_ami"');
    expect(result.variablesTf).toContain('variable "web_server_instance_type"');
    expect(result.diagnostics).toContain('Provider aws');
    expect(result.diagnostics).toContain('Processed 1 services');
  });

  it('generates GCP provider and GCS bucket resource', () => {
    const result = generateTerraformFromYaml(
      `
version: '0.1'
metadata:
  name: 'GCS Test'
infrastructure:
  clouds:
    - id: 'gcp-primary'
      provider: 'gcp'
      region: 'us-central1'
      services:
        - id: 'artifact-bucket-dev'
          type: 'storage'
          subtype: 'gcs'
          config:
            storage_class: 'STANDARD'
`,
      'gcs-test.adac.yaml',
      { provider: 'gcp', region: 'us-central1' }
    );

    expect(result.mainTf).toContain('provider "google"');
    expect(result.mainTf).toContain(
      'resource "google_storage_bucket" "artifact_bucket_dev"'
    );
    expect(result.variablesTf).toContain('variable "gcp_region"');
    expect(result.outputsTf).toContain('output "artifact-bucket-dev_name"');
    expect(result.diagnostics).toContain('Provider gcp');
  });

  it('generates AWS Lambda resource with extracted package and role variables', () => {
    const result = generateTerraformFromYaml(
      `
version: '0.1'
metadata:
  name: 'Lambda Test'
infrastructure:
  clouds:
    - id: 'aws-primary'
      provider: 'aws'
      region: 'us-east-1'
      services:
        - id: 'thumbnail-generator'
          type: 'compute'
          subtype: 'lambda'
          config:
            handler: 'src/index.handler'
            runtime: 'nodejs18.x'
            timeout: 15
`,
      'lambda-test.adac.yaml'
    );

    expect(result.mainTf).toContain(
      'resource "aws_lambda_function" "thumbnail_generator"'
    );
    expect(result.mainTf).toContain(
      'filename      = var.thumbnail_generator_filename'
    );
    expect(result.mainTf).toContain(
      'role          = var.thumbnail_generator_role_arn'
    );
    expect(result.mainTf).toContain('handler       = "src/index.handler"');
    expect(result.mainTf).toContain('runtime       = "nodejs18.x"');
    expect(result.variablesTf).toContain(
      'variable "thumbnail_generator_filename"'
    );
    expect(result.variablesTf).toContain(
      'variable "thumbnail_generator_role_arn"'
    );
    expect(result.outputsTf).toContain('output "thumbnail-generator_arn"');
  });

  it('generates AWS ECS task definitions with container definitions from ADAC config', () => {
    const result = generateTerraformFromYaml(
      `
version: '0.1'
metadata:
  name: 'ECS Test'
infrastructure:
  clouds:
    - id: 'aws-primary'
      provider: 'aws'
      region: 'us-east-1'
      services:
        - id: 'api-service'
          type: 'compute'
          subtype: 'ecs-fargate'
          config:
            cpu: 512
            memory: 1024
            containers:
              - name: 'api'
                image: 'example/api:1.2.3'
                port: 8080
              - name: 'worker'
                image: 'example/worker:1.2.3'
`,
      'ecs-test.adac.yaml'
    );

    expect(result.mainTf).toContain(
      'resource "aws_ecs_task_definition" "api_service"'
    );
    expect(result.mainTf).toContain('container_definitions    = <<DEFINITIONS');
    expect(result.mainTf).toContain('"name": "api"');
    expect(result.mainTf).toContain('"image": "example/api:1.2.3"');
    expect(result.mainTf).toContain('"containerPort": 8080');
    expect(result.mainTf).toContain('"name": "worker"');
    expect(result.mainTf).toContain('"image": "example/worker:1.2.3"');
  });

  it('generates AWS DynamoDB table resource', () => {
    const result = generateTerraformFromYaml(
      `
version: '0.1'
metadata:
  name: 'DynamoDB Test'
infrastructure:
  clouds:
    - id: 'aws-primary'
      provider: 'aws'
      region: 'us-east-1'
      services:
        - id: 'sessions-table'
          type: 'database'
          subtype: 'dynamodb'
          config:
            billing_mode: 'PAY_PER_REQUEST'
            hash_key: 'pk'
            range_key: 'sk'
            attributes:
              - name: 'pk'
                type: 'S'
              - name: 'sk'
                type: 'S'
`,
      'dynamodb-test.adac.yaml'
    );

    expect(result.mainTf).toContain(
      'resource "aws_dynamodb_table" "sessions_table"'
    );
    expect(result.mainTf).toContain('billing_mode = "PAY_PER_REQUEST"');
    expect(result.mainTf).toContain('hash_key     = "pk"');
    expect(result.mainTf).toContain('range_key     = "sk"');
    expect(result.mainTf).toContain('name = "pk"');
    expect(result.mainTf).toContain('name = "sk"');
    expect(result.outputsTf).toContain('output "sessions-table_arn"');
  });

  it('generates Terraform module blocks when module metadata is provided', () => {
    const result = generateTerraformFromYaml(
      `
version: '0.1'
metadata:
  name: 'Module Test'
infrastructure:
  clouds:
    - id: 'aws-primary'
      provider: 'aws'
      region: 'us-east-1'
      services:
        - id: 'vpc-main'
          type: 'networking'
          subtype: 'vpc'
          config:
            module:
              source: 'terraform-aws-modules/vpc/aws'
              inputs:
                name: 'main-vpc'
                cidr: '10.0.0.0/16'
                azs:
                  - 'us-east-1a'
                  - 'us-east-1b'
`,
      'module-test.adac.yaml'
    );

    expect(result.mainTf).toContain('module "vpc_main"');
    expect(result.mainTf).toContain('source = "terraform-aws-modules/vpc/aws"');
    expect(result.mainTf).toContain('name = "main-vpc"');
    expect(result.mainTf).toContain('cidr = "10.0.0.0/16"');
    expect(result.mainTf).not.toContain('resource "aws_vpc" "vpc_main"');
    expect(result.diagnostics).toContain('Generated 1 modules');
  });

  it('renders raw Terraform expressions in module inputs when explicitly requested', () => {
    const result = generateTerraformFromYaml(
      `
version: '0.1'
metadata:
  name: 'Module Expression Test'
infrastructure:
  clouds:
    - id: 'aws-primary'
      provider: 'aws'
      region: 'us-east-1'
      services:
        - id: 'module-test'
          type: 'networking'
          subtype: 'vpc'
          config:
            module:
              source: 'terraform-aws-modules/security-group/aws'
              inputs:
                name: 'module-test'
                vpc_id:
                  terraform: 'aws_vpc.vpc_main.id'
                ingress_cidr_blocks:
                  - '10.0.0.0/16'
`,
      'module-expression-test.adac.yaml'
    );

    expect(result.mainTf).toContain('module "module_test"');
    expect(result.mainTf).toContain('vpc_id = aws_vpc.vpc_main.id');
    expect(result.mainTf).not.toContain('vpc_id = "aws_vpc.vpc_main.id"');
    expect(result.mainTf).toContain('ingress_cidr_blocks = [');
  });

  it('parses ADAC yaml content and generates terraform', () => {
    const yamlContent = `
version: '0.1'
metadata:
  name: 'Minimal GCP Architecture'
  created: '2026-03-17'
infrastructure:
  clouds:
    - id: 'gcp-primary'
      provider: 'gcp'
      region: 'us-central1'
      services:
        - id: 'assets-bucket'
          service: 'cloud-storage'
          config:
            storage_class: 'STANDARD'
`;

    const result = generateTerraformFromYaml(
      yamlContent,
      'content-test.adac.yaml'
    );

    expect(result.mainTf).toContain('provider "google"');
    expect(result.mainTf).toContain(
      'resource "google_storage_bucket" "assets_bucket"'
    );
  });

  it('generates AWS VPC + subnet + security group from aws.adac.yaml', () => {
    const result = generateTerraformFromAdacFile(
      join(YAMLS_DIR, 'aws.adac.yaml')
    );

    expect(result.mainTf).toContain('provider "aws"');
    expect(result.mainTf).toContain('resource "aws_vpc" "vpc_main"');
    expect(result.mainTf).toContain('resource "aws_subnet" "public_subnet_a"');
    expect(result.mainTf).toContain(
      'vpc_id                  = aws_vpc.vpc_main.id'
    );
    expect(result.mainTf).toContain('resource "aws_subnet" "private_subnet_a"');
    expect(result.mainTf).toContain('resource "aws_security_group" "alb_sg"');
    expect(result.mainTf).toContain('vpc_id      = aws_vpc.vpc_main.id');
    expect(result.mainTf).toContain('resource "aws_lb" "alb"');
    expect(result.mainTf).toContain('subnets            = [');
    expect(result.mainTf).toContain('aws_subnet.public_subnet_a.id');
    expect(result.mainTf).toContain(
      'resource "aws_ecs_task_definition" "ecs_service"'
    );
    expect(result.mainTf).toContain('"name": "frontend"');
    expect(result.mainTf).toContain('"image": "example/frontend:1.0.0"');
    expect(result.mainTf).toContain('"containerPort": 3000');
    expect(result.mainTf).toContain('"name": "backend"');
    expect(result.mainTf).toContain('"image": "example/backend:1.0.0"');
    expect(result.mainTf).toContain('"containerPort": 8080');
    expect(result.mainTf).toContain('resource "aws_ecs_service" "ecs_service"');
    expect(result.mainTf).toContain(
      'cluster         = aws_ecs_cluster.ecs_service_cluster.id'
    );
    expect(result.mainTf).toContain(
      'resource "aws_db_subnet_group" "rds_postgres_subnet_group"'
    );
    expect(result.mainTf).toContain(
      'resource "aws_db_instance" "rds_postgres"'
    );
    expect(result.mainTf).toContain(
      'instance_class         = var.rds_postgres_instance_class'
    );
    expect(result.mainTf).toContain(
      'allocated_storage      = var.rds_postgres_allocated_storage'
    );
    expect(result.mainTf).toContain(
      'username               = var.rds_postgres_username'
    );
    expect(result.mainTf).toContain(
      'password               = var.rds_postgres_password'
    );
    expect(result.variablesTf).toContain(
      'variable "rds_postgres_instance_class"'
    );
    expect(result.variablesTf).toContain(
      'variable "rds_postgres_allocated_storage"'
    );
    expect(result.variablesTf).toContain('variable "rds_postgres_username"');
    expect(result.variablesTf).toContain('variable "rds_postgres_password"');
    expect(result.variablesTf).toContain('sensitive = true');
    expect(result.diagnostics).toContain('Provider aws');
  });

  it('generates GCP Cloud Run + Cloud SQL + GCS from gcp.adac.yaml', () => {
    const result = generateTerraformFromAdacFile(
      join(YAMLS_DIR, 'gcp.adac.yaml'),
      { provider: 'gcp' }
    );

    expect(result.mainTf).toContain('provider "google"');
    expect(result.mainTf).toContain(
      'resource "google_cloud_run_v2_service" "cloud_run_api"'
    );
    expect(result.mainTf).toContain(
      'resource "google_sql_database_instance" "cloud_sql_pg"'
    );
    expect(result.mainTf).toContain(
      'resource "google_storage_bucket" "cloud_storage_assets"'
    );
    expect(result.diagnostics).toContain('Provider gcp');
  });

  it(
    'passes terraform validate for generated AWS Terraform when Terraform CLI is available',
    () => {
      if (!hasTerraformCli()) {
        return;
      }

      const result = generateTerraformFromAdacFile(
      join(YAMLS_DIR, 'aws.adac.yaml')
    );
    const tempDir = mkdtempSync(TEMP_DIR_PREFIX);

    writeFileSync(join(tempDir, 'main.tf'), result.mainTf);
    writeFileSync(join(tempDir, 'variables.tf'), result.variablesTf);
    writeFileSync(join(tempDir, 'outputs.tf'), result.outputsTf);

    execFileSync('terraform', ['init', '-backend=false'], {
      cwd: tempDir,
      stdio: 'pipe',
    });

      execFileSync('terraform', ['validate'], {
        cwd: tempDir,
        stdio: 'pipe',
      });
    },
    120000
  );
});
