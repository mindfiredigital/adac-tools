import type {
  CloudFormationOutput,
  CloudFormationParameter,
  CloudFormationResource,
  CloudFormationResourceMapping,
  NormalizedAdacService,
} from '../types/index.js';

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

function lambdaCode(
  serviceId: string,
  cfg: Record<string, unknown>
): Record<string, string> {
  const inlineCode =
    typeof cfg.handler_source === 'string' && cfg.handler_source.length > 0
      ? cfg.handler_source
      : cfg.code;

  if (typeof inlineCode === 'string' && inlineCode.length > 0) {
    return { ZipFile: inlineCode };
  }

  const codeUri = cfg.code_uri;
  const s3Bucket = cfg.s3_bucket;
  const s3Key = cfg.s3_key;

  if (typeof codeUri === 'string' && codeUri.startsWith('s3://')) {
    const [, location] = codeUri.split('s3://');
    const [bucket, ...keyParts] = location.split('/');
    const key = keyParts.join('/');

    if (bucket && key) {
      return { S3Bucket: bucket, S3Key: key };
    }
  }

  if (
    typeof codeUri === 'string' &&
    codeUri.length > 0 &&
    typeof s3Key === 'string' &&
    s3Key.length > 0
  ) {
    return { S3Bucket: codeUri, S3Key: s3Key };
  }

  if (
    typeof s3Bucket === 'string' &&
    s3Bucket.length > 0 &&
    typeof s3Key === 'string' &&
    s3Key.length > 0
  ) {
    return { S3Bucket: s3Bucket, S3Key: s3Key };
  }

  throw new Error(
    `Lambda service "${serviceId}" requires explicit code via config.code, config.handler_source, config.code_uri, or config.s3_bucket/config.s3_key.`
  );
}

export function mapComputeServices(
  services: NormalizedAdacService[]
): CloudFormationResourceMapping {
  const parameters: Record<string, CloudFormationParameter> = {};
  const resources: Record<string, CloudFormationResource> = {};
  const outputs: Record<string, CloudFormationOutput> = {};

  for (const service of services) {
    if (service.type !== 'compute') {
      continue;
    }

    const cfg = service.config ?? {};
    const id = logicalId(service.id);

    if (service.subtype === 'ec2') {
      const amiParameter = `${id}ImageId`;
      const instanceTypeParameter = `${id}InstanceType`;

      parameters[amiParameter] = {
        Type: 'String',
        Description: `AMI for ${service.id}`,
      };

      parameters[instanceTypeParameter] = {
        Type: 'String',
        Description: `Instance type for ${service.id}`,
        Default: (cfg.instance_class as string | undefined) ?? 't3.micro',
      };

      resources[id] = {
        Type: 'AWS::EC2::Instance',
        Properties: {
          ImageId: parameterRef(amiParameter),
          InstanceType: parameterRef(instanceTypeParameter),
        },
      };

      outputs[`${id}Id`] = {
        Description: `Instance ID for ${service.id}`,
        Value: ref(service.id),
      };
    }

    if (service.subtype === 'ecs-fargate') {
      const clusterId = `${id}Cluster`;
      const taskDefinitionId = `${id}TaskDefinition`;
      const serviceId = `${id}Service`;
      const containers = Array.isArray(cfg.containers)
        ? cfg.containers.map((container, index) => {
            const definition = container as Record<string, unknown>;
            const image = definition.image;
            const name = (definition.name as string | undefined) ?? 'app';
            const port = definition.port as number | undefined;

            if (typeof image !== 'string' || image.length === 0) {
              throw new Error(
                `ECS Fargate service "${service.id}" container "${name}" at index ${index} is missing a required image.`
              );
            }

            return {
              Name: name,
              Image: image,
              PortMappings: port
                ? [{ ContainerPort: port, Protocol: 'tcp' }]
                : [],
              Essential: true,
            };
          })
        : [];
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

      resources[clusterId] = {
        Type: 'AWS::ECS::Cluster',
        Properties: {
          ClusterName: `${service.id}-cluster`,
        },
      };

      resources[taskDefinitionId] = {
        Type: 'AWS::ECS::TaskDefinition',
        Properties: {
          Family: service.id,
          RequiresCompatibilities: ['FARGATE'],
          NetworkMode: 'awsvpc',
          Cpu: String((cfg.cpu as number | undefined) ?? 256),
          Memory: String((cfg.memory as number | undefined) ?? 512),
          ExecutionRoleArn: {
            'Fn::Sub':
              'arn:aws:iam::${AWS::AccountId}:role/ecsTaskExecutionRole',
          },
          ContainerDefinitions: containers,
        },
      };

      resources[serviceId] = {
        Type: 'AWS::ECS::Service',
        Properties: {
          ServiceName: service.id,
          Cluster: ref(clusterId),
          LaunchType: 'FARGATE',
          DesiredCount: (cfg.desired_count as number | undefined) ?? 1,
          TaskDefinition: ref(taskDefinitionId),
          NetworkConfiguration: {
            AwsvpcConfiguration: {
              AssignPublicIp: 'DISABLED',
              Subnets: subnets,
              SecurityGroups: securityGroups,
            },
          },
        },
      };

      outputs[`${clusterId}Arn`] = {
        Description: `Cluster ARN for ${service.id}`,
        Value: { 'Fn::GetAtt': [clusterId, 'Arn'] },
      };
    }

    if (service.subtype === 'lambda') {
      const roleParameter = `${id}RoleArn`;

      parameters[roleParameter] = {
        Type: 'String',
        Description: `Lambda role ARN for ${service.id}`,
      };

      resources[id] = {
        Type: 'AWS::Lambda::Function',
        Properties: {
          FunctionName: service.id,
          Handler: (cfg.handler as string | undefined) ?? 'index.handler',
          Role: parameterRef(roleParameter),
          Runtime: (cfg.runtime as string | undefined) ?? 'nodejs20.x',
          Timeout: (cfg.timeout as number | undefined) ?? 30,
          Code: lambdaCode(service.id, cfg),
        },
      };

      outputs[`${id}Arn`] = {
        Description: `Lambda ARN for ${service.id}`,
        Value: { 'Fn::GetAtt': [id, 'Arn'] },
      };
    }
  }

  return { parameters, resources, outputs };
}
