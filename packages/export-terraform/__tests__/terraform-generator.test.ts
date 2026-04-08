import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { afterEach, describe, expect, it } from 'vitest';
import { generateTerraformFromAdacFile } from '../src/terraform-generator.js';

const YAMLS_DIR = resolve(join(import.meta.dirname, '../../../yamls'));
const TEMP_DIR_PREFIX = join(tmpdir(), 'adac-export-terraform-');
const tempDirs: string[] = [];

function createTempDir(): string {
  const tempDir = mkdtempSync(TEMP_DIR_PREFIX);
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

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
  const tempDir = createTempDir();
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
    expect(result.variablesTf).toContain('default = "us-central1"');
    expect(result.outputsTf).toContain('output "artifact-bucket-dev_name"');
    expect(result.diagnostics).toContain('Provider gcp');
  });

  it('uses the resolved GCP region as the gcp_region variable default', () => {
    const result = generateTerraformFromYaml(
      `
version: '0.1'
metadata:
  name: 'GCS Europe Test'
infrastructure:
  clouds:
    - id: 'gcp-primary'
      provider: 'gcp'
      region: 'europe-west1'
      services:
        - id: 'artifact-bucket-eu'
          type: 'storage'
          subtype: 'gcs'
`,
      'gcs-europe-test.adac.yaml',
      { provider: 'gcp', region: 'europe-west1' }
    );

    expect(result.variablesTf).toContain('variable "gcp_region"');
    expect(result.variablesTf).toContain('default = "europe-west1"');
  });

  it('defaults GCP region to us-central1 when a selected cloud omits region', () => {
    const result = generateTerraformFromYaml(
      `
version: '0.1'
metadata:
  name: 'GCS Default Region Test'
infrastructure:
  clouds:
    - id: 'gcp-primary'
      provider: 'gcp'
      services:
        - id: 'artifact-bucket-default'
          type: 'storage'
          subtype: 'gcs'
`,
      'gcs-default-region-test.adac.yaml'
    );

    expect(result.mainTf).toContain(
      'provider "google" {\n  region = "us-central1"\n}'
    );
    expect(result.variablesTf).toContain('default = "us-central1"');
  });

  it('defaults GCP region to us-central1 when no clouds are defined but provider is gcp', () => {
    const result = generateTerraformFromYaml(
      `
version: '0.1'
metadata:
  name: 'No Clouds GCP Test'
infrastructure:
  clouds: []
`,
      'no-clouds-gcp-test.adac.yaml',
      { provider: 'gcp' }
    );

    expect(result.mainTf).toContain(
      'provider "google" {\n  region = "us-central1"\n}'
    );
    expect(result.diagnostics).toContain('Provider gcp');
    expect(result.diagnostics).toContain('Processed 0 services');
  });

  it('generates GCP subnets with a required network reference', () => {
    const result = generateTerraformFromYaml(
      `
version: '0.1'
metadata:
  name: 'GCP Subnet Test'
infrastructure:
  clouds:
    - id: 'gcp-primary'
      provider: 'gcp'
      region: 'us-central1'
      services:
        - id: 'vpc-main'
          type: 'networking'
          subtype: 'vpc'
        - id: 'subnet-a'
          type: 'networking'
          subtype: 'subnet'
          config:
            cidr: '10.10.0.0/24'
            network: 'vpc-main'
`,
      'gcp-subnet-test.adac.yaml',
      { provider: 'gcp', region: 'us-central1' }
    );

    expect(result.mainTf).toContain(
      'resource "google_compute_subnetwork" "subnet_a"'
    );
    expect(result.mainTf).toContain(
      'network       = google_compute_network.vpc_main.id'
    );
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
            subnets: ['private-subnet-a']
            security_groups: ['ecs-sg']
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

  it('throws for ECS service with empty containers list', () => {
    expect(() =>
      generateTerraformFromYaml(
        `
version: '0.1'
metadata:
  name: 'ECS Empty Containers Test'
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
            containers: []
`,
        'ecs-empty-containers-test.adac.yaml'
      )
    ).toThrow(/must define at least one container/i);
  });

  it('throws for ECS service when a container image is missing', () => {
    expect(() =>
      generateTerraformFromYaml(
        `
version: '0.1'
metadata:
  name: 'ECS Missing Image Test'
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
            containers:
              - name: 'api'
`,
        'ecs-missing-image-test.adac.yaml'
      )
    ).toThrow(/must define a non-empty image/i);
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

  it('ensures DynamoDB key attributes exist and adds capacities for provisioned tables', () => {
    const result = generateTerraformFromYaml(
      `
version: '0.1'
metadata:
  name: 'DynamoDB Provisioned Test'
infrastructure:
  clouds:
    - id: 'aws-primary'
      provider: 'aws'
      region: 'us-east-1'
      services:
        - id: 'orders-table'
          type: 'database'
          subtype: 'dynamodb'
          config:
            billing_mode: 'PROVISIONED'
            hash_key: 'pk'
            range_key: 'sk'
            read_capacity: 10
            write_capacity: 4
            attributes:
              - name: 'status'
                type: 'S'
`,
      'dynamodb-provisioned-test.adac.yaml'
    );

    expect(result.mainTf).toContain('billing_mode = "PROVISIONED"');
    expect(result.mainTf).toContain('read_capacity  = 10');
    expect(result.mainTf).toContain('write_capacity = 4');
    expect(result.mainTf).toContain('hash_key     = "pk"');
    expect(result.mainTf).toContain('range_key     = "sk"');
    expect(result.mainTf).toContain('name = "pk"');
    expect(result.mainTf).toContain('name = "sk"');
    expect(result.mainTf).toContain('name = "status"');
  });

  it('applies secure defaults for AWS RDS Postgres resources', () => {
    const result = generateTerraformFromYaml(
      `
version: '0.1'
metadata:
  name: 'RDS Defaults Test'
infrastructure:
  clouds:
    - id: 'aws-primary'
      provider: 'aws'
      region: 'us-east-1'
      services:
        - id: 'db-main'
          type: 'database'
          subtype: 'rds-postgres'
          config:
            subnets: ['private-subnet-a']
            security_groups: ['ecs-sg']
`,
      'rds-defaults-test.adac.yaml'
    );

    expect(result.mainTf).toContain('storage_encrypted      = true');
    expect(result.mainTf).toContain('deletion_protection    = true');
    expect(result.mainTf).toContain('backup_retention_period = 30');
    expect(result.mainTf).toContain('skip_final_snapshot    = false');
    expect(result.mainTf).toContain(
      'final_snapshot_identifier = "db-main-final-snapshot"'
    );
  });

  it('respects explicit RDS safety overrides from config', () => {
    const result = generateTerraformFromYaml(
      `
version: '0.1'
metadata:
  name: 'RDS Override Test'
infrastructure:
  clouds:
    - id: 'aws-primary'
      provider: 'aws'
      region: 'us-east-1'
      services:
        - id: 'db-override'
          type: 'database'
          subtype: 'rds-postgres'
          config:
            subnets: ['private-subnet-a']
            security_groups: ['ecs-sg']
            storage_encrypted: false
            deletion_protection: false
            backup_retention_period: 7
            skip_final_snapshot: true
`,
      'rds-override-test.adac.yaml'
    );

    expect(result.mainTf).toContain('storage_encrypted      = false');
    expect(result.mainTf).toContain('deletion_protection    = false');
    expect(result.mainTf).toContain('backup_retention_period = 7');
    expect(result.mainTf).toContain('skip_final_snapshot    = true');
    expect(result.mainTf).not.toContain('final_snapshot_identifier =');
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

  it('quotes non-identifier object keys in module map inputs', () => {
    const result = generateTerraformFromYaml(
      `
version: '0.1'
metadata:
  name: 'Module Map Key Test'
infrastructure:
  clouds:
    - id: 'aws-primary'
      provider: 'aws'
      region: 'us-east-1'
      services:
        - id: 'module-map-test'
          type: 'networking'
          subtype: 'vpc'
          config:
            module:
              source: 'terraform-aws-modules/security-group/aws'
              inputs:
                tags:
                  cost-center: 'platform'
                  owner_team: 'adac'
`,
      'module-map-key-test.adac.yaml'
    );

    expect(result.mainTf).toContain('tags = {');
    expect(result.mainTf).toContain('"cost-center" = "platform"');
    expect(result.mainTf).toContain('owner_team = "adac"');
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
    expect(result.mainTf).toContain('storage_encrypted      = true');
    expect(result.mainTf).toContain('deletion_protection    = true');
    expect(result.mainTf).toContain('backup_retention_period = 7');
    expect(result.mainTf).toContain('skip_final_snapshot    = false');
    expect(result.mainTf).toContain(
      'final_snapshot_identifier = "rds-postgres-final-snapshot"'
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

  it.skipIf(!hasTerraformCli())(
    'passes terraform validate for generated AWS Terraform when Terraform CLI is available',
    () => {
      const result = generateTerraformFromAdacFile(
        join(YAMLS_DIR, 'aws.adac.yaml')
      );
      const tempDir = createTempDir();

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

  it('throws a parse error for malformed YAML input', () => {
    expect(() =>
      generateTerraformFromYaml(
        `
version: '0.1'
metadata:
  name: 'Broken YAML Test'
  created: '2026-04-08'
infrastructure:
  clouds:
    - id: 'aws-primary'
      provider: 'aws'
      region: 'us-east-1'
      services:
        - id: 'bad-service'
          type: 'compute'
          subtype: 'ec2'
          config:
            instance_class: 't3.micro'
: invalid
`,
        'malformed-test.adac.yaml'
      )
    ).toThrow(/Failed to parse YAML content/);
  });

  it('throws a schema validation error when validate=true and required fields are missing', () => {
    const invalidSchemaYaml = `
applications:
  - id: app1
infrastructure:
  clouds: []
`;

    const tempDir = createTempDir();
    const filePath = join(tempDir, 'invalid-schema-test.adac.yaml');
    writeFileSync(filePath, invalidSchemaYaml);

    expect(() =>
      generateTerraformFromAdacFile(filePath, {
        validate: true,
      })
    ).toThrow(/Schema validation failed/);
  });

  it('throws when config has no cloud and no provider override', () => {
    expect(() =>
      generateTerraformFromYaml(
        `
version: '0.1'
metadata:
  name: 'No Cloud Test'
  created: '2026-04-08'
infrastructure:
  clouds: []
`,
        'no-cloud-test.adac.yaml'
      )
    ).toThrow(/Provider must be specified/);
  });
});
