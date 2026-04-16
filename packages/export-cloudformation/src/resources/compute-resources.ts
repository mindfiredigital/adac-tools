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
        ? cfg.containers.map((container) => {
            const definition = container as Record<string, unknown>;
            const port = definition.port as number | undefined;

            return {
              Name: (definition.name as string | undefined) ?? 'app',
              Image:
                (definition.image as string | undefined) ??
                'public.ecr.aws/docker/library/nginx:latest',
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
          ExecutionRoleArn: 'arn:aws:iam::123456789012:role/ecsTaskExecutionRole',
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
        Value: { Ref: clusterId },
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
          Code: {
            ZipFile:
              'exports.handler = async () => ({ statusCode: 200, body: "ok" });',
          },
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
