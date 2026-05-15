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
  const diagnostics: string[] = [];

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
      const subnetAvailabilityZones = new Map(
        services
          .filter(
            (candidate) =>
              candidate.type === 'networking' && candidate.subtype === 'subnet'
          )
          .map((candidate) => [
            logicalId(candidate.id),
            subnetAvailabilityZone(candidate.config ?? {}),
          ])
      );
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
      const seenSubnetRefs = new Set(subnets.map((subnet) => subnet.Ref));
      const pickUniqueSubnetRefs = (
        candidates: typeof subnetCandidates
      ): { Ref: string }[] =>
        candidates
          .map((candidate) => candidate.ref)
          .filter((candidateRef) => {
            if (seenSubnetRefs.has(candidateRef.Ref)) {
              return false;
            }

            seenSubnetRefs.add(candidateRef.Ref);
            return true;
          });
      const privateFallbackSubnets = pickUniqueSubnetRefs(
        subnetCandidates.filter((candidate) => !candidate.isPublic)
      );
      const anySubnetFallbacks = pickUniqueSubnetRefs(subnetCandidates);
      const subnetIds =
        subnets.length >= 2
          ? subnets
          : [
              ...subnets,
              ...privateFallbackSubnets,
              ...anySubnetFallbacks,
            ].slice(0, 2);
      const subnetAvailabilityZoneCount = new Set(
        subnetIds
          .map((subnet) => subnetAvailabilityZones.get(subnet.Ref))
          .filter((zone): zone is string => typeof zone === 'string')
      ).size;

      if (subnetAvailabilityZoneCount < 2) {
        diagnostics.push(
          `RDS service "${service.id}" DBSubnetGroup has fewer than 2 distinct Availability Zones for subnets: ${subnetIds.map((subnet) => subnet.Ref).join(', ') || 'none'}.`
        );
      }

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

  return { parameters, resources, outputs, diagnostics };
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

function subnetAvailabilityZone(config: Record<string, unknown>): string {
  const availabilityZone =
    config.availability_zone ?? config.availabilityZone ?? config.az;

  return typeof availabilityZone === 'string' && availabilityZone.length > 0
    ? availabilityZone
    : 'us-east-1a';
}

function parameterRef(name: string): { Ref: string } {
  return { Ref: name };
}
