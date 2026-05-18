import type {
  AdacService,
  CloudProvider,
  TerraformOutput,
  TerraformResourceMapping,
  TerraformVariable,
} from '../types/index.js';
import {
  terraformLabel,
  terraformRef,
  terraformStringList,
} from '../utils/terraform-names.js';

/**
 * Maps ADAC database services to Terraform resource, variable, and output blocks.
 * Handles AWS RDS Postgres, DynamoDB, and GCP Cloud SQL.
 */
export function mapDatabaseServices(
  services: AdacService[],
  provider: CloudProvider
): TerraformResourceMapping {
  const resources: string[] = [];
  const variables: TerraformVariable[] = [];
  const outputs: TerraformOutput[] = [];

  for (const service of services) {
    if (service.type !== 'database') {
      continue;
    }

    const serviceProvider = service.cloud ?? provider;
    const cfg = service.config ?? {};
    const resourceLabel = terraformLabel(service.id);

    if (serviceProvider === 'aws' && service.subtype === 'rds-postgres') {
      const instanceClass =
        (cfg.instance_class as string | undefined) ?? 'db.t3.micro';
      const storage = (cfg.allocated_storage as number | undefined) ?? 20;
      const multiAz = cfg.multi_az === true;
      const storageEncrypted =
        typeof cfg.storage_encrypted === 'boolean'
          ? cfg.storage_encrypted
          : typeof cfg.encrypted === 'boolean'
            ? cfg.encrypted
            : true;
      const deletionProtection =
        typeof cfg.deletion_protection === 'boolean'
          ? cfg.deletion_protection
          : true;
      const backupRetentionPeriod =
        typeof cfg.backup_retention_period === 'number'
          ? cfg.backup_retention_period
          : typeof cfg.backupRetentionPeriod === 'number'
            ? cfg.backupRetentionPeriod
            : 30;
      const skipFinalSnapshot =
        typeof cfg.skip_final_snapshot === 'boolean'
          ? cfg.skip_final_snapshot
          : false;
      const finalSnapshotIdentifier =
        (cfg.final_snapshot_identifier as string | undefined) ??
        `${service.id}-final-snapshot`;
      const finalSnapshotBlock = skipFinalSnapshot
        ? '  skip_final_snapshot    = true'
        : `  skip_final_snapshot    = false\n  final_snapshot_identifier = "${finalSnapshotIdentifier}"`;
      const subnets = Array.isArray(cfg.subnets)
        ? cfg.subnets
            .filter((subnet): subnet is string => typeof subnet === 'string')
            .map((subnet) => terraformRef('aws_subnet', subnet, 'id'))
        : [];
      const securityGroups = Array.isArray(cfg.security_groups)
        ? cfg.security_groups
            .filter((sg): sg is string => typeof sg === 'string')
            .map((sg) => terraformRef('aws_security_group', sg, 'id'))
        : [];
      const subnetGroupName = `${service.id}_subnet_group`;
      const instanceClassVariableName = `${resourceLabel}_instance_class`;
      const allocatedStorageVariableName = `${resourceLabel}_allocated_storage`;
      const usernameVariableName = `${resourceLabel}_username`;
      const passwordVariableName = `${resourceLabel}_password`;

      resources.push(
        `resource "aws_db_subnet_group" "${terraformLabel(subnetGroupName)}" {\n  name       = "${service.id}-subnet-group"\n  subnet_ids = ${terraformStringList(subnets)}\n}\n\nresource "aws_db_instance" "${resourceLabel}" {\n  identifier             = "${service.id}"\n  engine                 = "postgres"\n  instance_class         = var.${instanceClassVariableName}\n  allocated_storage      = var.${allocatedStorageVariableName}\n  username               = var.${usernameVariableName}\n  password               = var.${passwordVariableName}\n  multi_az               = ${multiAz}\n  storage_encrypted      = ${storageEncrypted}\n  deletion_protection    = ${deletionProtection}\n  backup_retention_period = ${backupRetentionPeriod}\n${finalSnapshotBlock}\n  db_subnet_group_name   = ${terraformRef('aws_db_subnet_group', subnetGroupName, 'name')}\n  vpc_security_group_ids = ${terraformStringList(securityGroups)}\n}`
      );

      variables.push({
        name: instanceClassVariableName,
        type: 'string',
        description: `RDS instance class for ${service.id}`,
        default: instanceClass,
      });

      variables.push({
        name: allocatedStorageVariableName,
        type: 'number',
        description: `Allocated storage (GB) for ${service.id}`,
        default: storage,
      });

      variables.push({
        name: usernameVariableName,
        type: 'string',
        description: `Database username for ${service.id}`,
        default: 'admin',
      });

      variables.push({
        name: passwordVariableName,
        type: 'string',
        description: `Database password for ${service.id}`,
        sensitive: true,
      });

      outputs.push({
        name: `${service.id}_endpoint`,
        description: `RDS endpoint for ${service.id}`,
        value: terraformRef('aws_db_instance', resourceLabel, 'endpoint'),
      });
    }

    if (serviceProvider === 'aws' && service.subtype === 'dynamodb') {
      const billingMode =
        (cfg.billing_mode as string | undefined) ?? 'PAY_PER_REQUEST';
      const hashKey = (cfg.hash_key as string | undefined) ?? 'id';
      const rangeKey =
        typeof cfg.range_key === 'string' ? cfg.range_key : undefined;
      const readCapacity =
        typeof cfg.read_capacity === 'number' ? cfg.read_capacity : 5;
      const writeCapacity =
        typeof cfg.write_capacity === 'number' ? cfg.write_capacity : 5;
      const attributeConfigs = Array.isArray(cfg.attributes)
        ? cfg.attributes
            .map((attribute) => {
              const attr = attribute as Record<string, unknown>;
              const name = attr.name;
              const type = attr.type;

              if (typeof name !== 'string' || typeof type !== 'string') {
                return undefined;
              }

              return { name, type };
            })
            .filter(
              (
                attribute
              ): attribute is {
                name: string;
                type: string;
              } => attribute !== undefined
            )
        : [];
      const attributesByName = new Map(
        attributeConfigs.map((attribute) => [attribute.name, attribute])
      );

      if (!attributesByName.has(hashKey)) {
        attributesByName.set(hashKey, { name: hashKey, type: 'S' });
      }

      if (rangeKey && !attributesByName.has(rangeKey)) {
        attributesByName.set(rangeKey, { name: rangeKey, type: 'S' });
      }

      const attributes = Array.from(attributesByName.values());
      const attributeBlocks = attributes
        .map(
          (attribute) =>
            `  attribute {\n    name = "${attribute.name}"\n    type = "${attribute.type}"\n  }`
        )
        .join('\n');
      const rangeKeyLine = rangeKey ? `\n  range_key     = "${rangeKey}"` : '';
      const capacityLines =
        billingMode === 'PROVISIONED'
          ? `\n  read_capacity  = ${readCapacity}\n  write_capacity = ${writeCapacity}`
          : '';

      resources.push(
        `resource "aws_dynamodb_table" "${resourceLabel}" {\n  name         = "${service.id}"\n  billing_mode = "${billingMode}"\n  hash_key     = "${hashKey}"${rangeKeyLine}${capacityLines}\n${attributeBlocks}\n}`
      );

      outputs.push({
        name: `${service.id}_arn`,
        description: `DynamoDB table ARN for ${service.id}`,
        value: terraformRef('aws_dynamodb_table', resourceLabel, 'arn'),
      });
    }

    if (serviceProvider === 'gcp' && service.subtype === 'cloud-sql') {
      const dbVersion =
        (cfg.database_version as string | undefined) ?? 'POSTGRES_15';
      const tier = (cfg.tier as string | undefined) ?? 'db-f1-micro';

      resources.push(
        `resource "google_sql_database_instance" "${resourceLabel}" {\n  name             = "${service.id}"\n  region           = var.gcp_region\n  database_version = "${dbVersion}"\n\n  settings {\n    tier = "${tier}"\n  }\n}`
      );

      variables.push({
        name: 'gcp_region',
        type: 'string',
        description: 'GCP region for resources',
        default: 'us-central1',
      });

      outputs.push({
        name: `${service.id}_connection_name`,
        description: `Cloud SQL connection name for ${service.id}`,
        value: terraformRef(
          'google_sql_database_instance',
          resourceLabel,
          'connection_name'
        ),
      });
    }
  }

  return {
    resources,
    variables,
    outputs,
  };
}
