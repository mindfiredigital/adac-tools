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

export function mapNetworkingServices(
  services: NormalizedAdacService[]
): CloudFormationResourceMapping {
  const parameters: Record<string, CloudFormationParameter> = {};
  const resources: Record<string, CloudFormationResource> = {};
  const outputs: Record<string, CloudFormationOutput> = {};

  for (const service of services) {
    if (service.type !== 'networking') {
      continue;
    }

    const cfg = service.config ?? {};
    const id = logicalId(service.id);

    if (service.subtype === 'vpc') {
      resources[id] = {
        Type: 'AWS::EC2::VPC',
        Properties: {
          CidrBlock: (cfg.cidr as string | undefined) ?? '10.0.0.0/16',
          EnableDnsSupport: cfg.dns_support ?? true,
          EnableDnsHostnames: cfg.dns_hostnames ?? true,
          Tags: [{ Key: 'Name', Value: service.id }],
        },
      };

      outputs[`${id}Id`] = {
        Description: `VPC ID for ${service.id}`,
        Value: ref(service.id),
      };
    }

    if (service.subtype === 'subnet') {
      const vpc = cfg.vpc as string | undefined;
      const availabilityZoneParameter = `${id}AvailabilityZone`;

      parameters[availabilityZoneParameter] = {
        Type: 'AWS::EC2::AvailabilityZone::Name',
        Description: `Availability Zone for ${service.id}`,
        Default:
          (cfg.availability_zone as string | undefined) ?? 'us-east-1a',
      };

      resources[id] = {
        Type: 'AWS::EC2::Subnet',
        Properties: {
          VpcId: vpc ? ref(vpc) : undefined,
          CidrBlock: (cfg.cidr as string | undefined) ?? '10.0.0.0/24',
          AvailabilityZone: { Ref: availabilityZoneParameter },
          MapPublicIpOnLaunch: cfg.public === true,
          Tags: [{ Key: 'Name', Value: service.id }],
        },
      };

      outputs[`${id}Id`] = {
        Description: `Subnet ID for ${service.id}`,
        Value: ref(service.id),
      };
    }

    if (service.subtype === 'security-group') {
      const ingress = Array.isArray(cfg.ingress)
        ? cfg.ingress.map((rule) => {
            const ingressRule = rule as Record<string, unknown>;
            const sourceSecurityGroup = ingressRule.source_security_group as
              | string
              | undefined;

            return {
              IpProtocol: (ingressRule.protocol as string | undefined) ?? 'tcp',
              FromPort: (ingressRule.port as number | undefined) ?? 0,
              ToPort: (ingressRule.port as number | undefined) ?? 0,
              CidrIp: sourceSecurityGroup
                ? undefined
                : ((ingressRule.cidr as string | undefined) ?? '0.0.0.0/0'),
              SourceSecurityGroupId: sourceSecurityGroup
                ? ref(sourceSecurityGroup)
                : undefined,
            };
          })
        : [];

      resources[id] = {
        Type: 'AWS::EC2::SecurityGroup',
        Properties: {
          GroupDescription: `Managed by ADAC export-cloudformation for ${service.id}`,
          VpcId: cfg.vpc ? ref(String(cfg.vpc)) : undefined,
          SecurityGroupIngress: ingress,
          Tags: [{ Key: 'Name', Value: service.id }],
        },
      };

      outputs[`${id}Id`] = {
        Description: `Security group ID for ${service.id}`,
        Value: ref(service.id),
      };
    }

    if (
      service.subtype === 'application-load-balancer' ||
      service.subtype === 'alb'
    ) {
      const subnetCandidates = services.filter(
        (candidate) =>
          candidate.type === 'networking' &&
          candidate.subtype === 'subnet' &&
          candidate.id !== service.id
      );
      const configuredSubnets = Array.isArray(cfg.subnets)
        ? cfg.subnets
            .filter((subnet): subnet is string => typeof subnet === 'string')
            .map((subnet) => ref(subnet))
        : [];
      const publicFallbackSubnets = subnetCandidates
        .filter((candidate) => {
          const subnetConfig = candidate.config ?? {};

          return subnetConfig.public === true;
        })
        .map((candidate) => ref(candidate.id))
        .filter(
          (candidateRef, index, allRefs) =>
            allRefs.findIndex(
              (item) => JSON.stringify(item) === JSON.stringify(candidateRef)
            ) === index
        )
        .filter(
          (candidateRef) =>
            !configuredSubnets.some(
              (configuredSubnet) =>
                JSON.stringify(configuredSubnet) === JSON.stringify(candidateRef)
            )
        );
      const anySubnetFallbacks = subnetCandidates
        .map((candidate) => ref(candidate.id))
        .filter(
          (candidateRef, index, allRefs) =>
            allRefs.findIndex(
              (item) => JSON.stringify(item) === JSON.stringify(candidateRef)
            ) === index
        )
        .filter(
          (candidateRef) =>
            !configuredSubnets.some(
              (configuredSubnet) =>
                JSON.stringify(configuredSubnet) === JSON.stringify(candidateRef)
            ) &&
            !publicFallbackSubnets.some(
              (fallbackSubnet) =>
                JSON.stringify(fallbackSubnet) === JSON.stringify(candidateRef)
            )
        );
      const subnets =
        configuredSubnets.length >= 2
          ? configuredSubnets
          : [
              ...configuredSubnets,
              ...publicFallbackSubnets,
              ...anySubnetFallbacks,
            ].slice(0, 2);
      const securityGroups = Array.isArray(cfg.security_groups)
        ? cfg.security_groups
            .filter((group): group is string => typeof group === 'string')
            .map((group) => ref(group))
        : [];

      resources[id] = {
        Type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
        Properties: {
          Name: service.id,
          Type: 'application',
          Scheme:
            (cfg.scheme as string | undefined) ?? 'internet-facing',
          Subnets: subnets,
          SecurityGroups: securityGroups,
        },
      };

      outputs[`${id}DnsName`] = {
        Description: `Load balancer DNS name for ${service.id}`,
        Value: { 'Fn::GetAtt': [id, 'DNSName'] },
      };
    }
  }

  return { parameters, resources, outputs };
}
