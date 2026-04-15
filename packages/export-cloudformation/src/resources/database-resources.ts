import type {
  CloudFormationOutput,
  CloudFormationParameter,
  CloudFormationResource,
  CloudFormationResourceMapping,
  NormalizedAdacService,
} from '../types/index.js';

export function mapDatabaseServices(
  services: NormalizedAdacService[]
): CloudFormationResourceMapping {
  const parameters: Record<string, CloudFormationParameter> = {};
  const resources: Record<string, CloudFormationResource> = {};
  const outputs: Record<string, CloudFormationOutput> = {};

  for (const service of services) {
    if (service.type !== 'database') {
      continue;
    }

    const cfg = service.config ?? {};
    const id = logicalId(service.id);

    if (service.subtype === 'rds-postgres') {
      const subnetGroupId = `${id}SubnetGroup`;
      const usernameParameter = `${id}MasterUsername`;
      const instanceClassParameter = `${id}InstanceClass`;
      const configuredEngineVersion =
        (cfg.engine_version as string | undefined) ?? '17.8';
      const engineVersion =
        configuredEngineVersion === '14' || configuredEngineVersion === '16'
          ? '17.8'
          : configuredEngineVersion;
      const subnets = Array.isArray(cfg.subnets)
        ? cfg.subnets
            .filter((subnet): subnet is string => typeof subnet === 'string')
            .map((subnet) => ref(subnet))
        : [];
      const securityGroups = Array.isArray(cfg.security_groups)
        ? cfg.security_groups
            .filter((group): group is string => typeof group === 'string')
            .map((group) => ref(group))
        : [];
      const subnetCandidates = services
        .filter(
          (candidate) =>
            candidate.type === 'networking' &&
            candidate.subtype === 'subnet' &&
            candidate.id !== service.id
        )
        .map((candidate) => ({
          ref: ref(candidate.id),
          isPublic: candidate.config?.public === true,
        }));
      const privateFallbackSubnets = subnetCandidates
        .filter((candidate) => !candidate.isPublic)
        .map((candidate) => candidate.ref)
        .filter(
          (candidateRef, index, allRefs) =>
            allRefs.findIndex(
              (item) => JSON.stringify(item) === JSON.stringify(candidateRef)
            ) === index
        )
        .filter(
          (candidateRef) =>
            !subnets.some(
              (configuredSubnet) =>
                JSON.stringify(configuredSubnet) === JSON.stringify(candidateRef)
            )
        );
      const anySubnetFallbacks = subnetCandidates
        .map((candidate) => candidate.ref)
        .filter(
          (candidateRef, index, allRefs) =>
            allRefs.findIndex(
              (item) => JSON.stringify(item) === JSON.stringify(candidateRef)
            ) === index
        )
        .filter(
          (candidateRef) =>
            !subnets.some(
              (configuredSubnet) =>
                JSON.stringify(configuredSubnet) === JSON.stringify(candidateRef)
            ) &&
            !privateFallbackSubnets.some(
              (fallbackSubnet) =>
                JSON.stringify(fallbackSubnet) === JSON.stringify(candidateRef)
            )
        );
      const subnetIds =
        subnets.length >= 2
          ? subnets
          : [...subnets, ...privateFallbackSubnets, ...anySubnetFallbacks].slice(
              0,
              2
            );

      parameters[usernameParameter] = {
        Type: 'String',
        Description: `Database username for ${service.id}`,
        Default: 'admin',
      };

      parameters[instanceClassParameter] = {
        Type: 'String',
        Description: `Database instance class for ${service.id}`,
        Default: (cfg.instance_class as string | undefined) ?? 'db.t3.micro',
      };

      resources[subnetGroupId] = {
        Type: 'AWS::RDS::DBSubnetGroup',
        Properties: {
          DBSubnetGroupDescription: `Subnet group for ${service.id}`,
          SubnetIds: subnetIds,
        },
      };

      resources[id] = {
        Type: 'AWS::RDS::DBInstance',
        Properties: {
          DBInstanceIdentifier: service.id,
          Engine: 'postgres',
          EngineVersion: engineVersion,
          DBInstanceClass: parameterRef(instanceClassParameter),
          AllocatedStorage: String(
            (cfg.allocated_storage as number | undefined) ?? 20
          ),
          MasterUsername: parameterRef(usernameParameter),
          ManageMasterUserPassword: true,
          MultiAZ: cfg.multi_az === true,
          StorageEncrypted: cfg.encrypted !== false,
          PubliclyAccessible: cfg.publiclyAccessible === true,
          VPCSecurityGroups: securityGroups,
          DBSubnetGroupName: ref(subnetGroupId),
        },
      };

      outputs[`${id}Endpoint`] = {
        Description: `RDS endpoint for ${service.id}`,
        Value: { 'Fn::GetAtt': [id, 'Endpoint.Address'] },
      };
    }

    if (service.subtype === 'dynamodb') {
      const hashKey = (cfg.hash_key as string | undefined) ?? 'id';
      const rangeKey = cfg.range_key as string | undefined;
      const configuredAttributes = Array.isArray(cfg.attributes)
        ? cfg.attributes
            .map((attribute) => {
              const attr = attribute as Record<string, unknown>;
              const name = attr.name;
              const type = attr.type;

              if (typeof name !== 'string' || typeof type !== 'string') {
                return undefined;
              }

              return { AttributeName: name, AttributeType: type };
            })
            .filter(
              (
                attribute
              ): attribute is {
                AttributeName: string;
                AttributeType: string;
              } => attribute !== undefined
            )
        : [];
      const attributeDefinitions =
        configuredAttributes.length > 0
          ? configuredAttributes
          : [
              { AttributeName: hashKey, AttributeType: 'S' },
              ...(rangeKey
                ? [{ AttributeName: rangeKey, AttributeType: 'S' }]
                : []),
            ];

      resources[id] = {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: service.id,
          BillingMode:
            (cfg.billing_mode as string | undefined) ?? 'PAY_PER_REQUEST',
          AttributeDefinitions: attributeDefinitions,
          KeySchema: [
            { AttributeName: hashKey, KeyType: 'HASH' },
            ...(rangeKey
              ? [{ AttributeName: rangeKey, KeyType: 'RANGE' }]
              : []),
          ],
        },
      };

      outputs[`${id}Arn`] = {
        Description: `DynamoDB table ARN for ${service.id}`,
        Value: { 'Fn::GetAtt': [id, 'Arn'] },
      };
    }
  }

  return { parameters, resources, outputs };
}

function logicalId(value: string): string {
  return value
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function ref(value: string): { Ref: string } {
  return { Ref: logicalId(value) };
}

function parameterRef(name: string): { Ref: string } {
  return { Ref: name };
}
