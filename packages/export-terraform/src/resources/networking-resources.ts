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
 * Maps ADAC networking services to Terraform resource, variable, and output blocks.
 * Handles AWS VPC, Subnet, Security Group, ALB, and GCP VPC, Subnet, Load Balancer.
 */
export function mapNetworkingServices(
  services: AdacService[],
  provider: CloudProvider
): TerraformResourceMapping {
  const resources: string[] = [];
  const variables: TerraformVariable[] = [];
  const outputs: TerraformOutput[] = [];

  for (const service of services) {
    if (service.type !== 'networking') {
      continue;
    }

    const serviceProvider = service.cloud ?? provider;
    const cfg = service.config ?? {};

    if (serviceProvider === 'aws') {
      const resourceLabel = terraformLabel(service.id);

      if (service.subtype === 'vpc') {
        const cidr = (cfg.cidr as string | undefined) ?? '10.0.0.0/16';

        resources.push(
          `resource "aws_vpc" "${resourceLabel}" {\n  cidr_block           = "${cidr}"\n  enable_dns_support   = true\n  enable_dns_hostnames = true\n}`
        );

        outputs.push({
          name: `${service.id}_id`,
          description: `VPC ID for ${service.id}`,
          value: terraformRef('aws_vpc', service.id, 'id'),
        });
      }

      if (service.subtype === 'subnet') {
        const cidr = (cfg.cidr as string | undefined) ?? '10.0.0.0/24';
        const az =
          (cfg.availability_zone as string | undefined) ?? 'us-east-1a';
        const isPublic = cfg.public === true;
        const vpc = typeof cfg.vpc === 'string' ? cfg.vpc : undefined;
        const vpcId = vpc ? terraformRef('aws_vpc', vpc, 'id') : 'null';

        resources.push(
          `resource "aws_subnet" "${resourceLabel}" {\n  vpc_id                  = ${vpcId}\n  cidr_block              = "${cidr}"\n  availability_zone       = "${az}"\n  map_public_ip_on_launch = ${isPublic}\n}`
        );

        outputs.push({
          name: `${service.id}_id`,
          description: `Subnet ID for ${service.id}`,
          value: terraformRef('aws_subnet', service.id, 'id'),
        });
      }

      if (service.subtype === 'security-group') {
        const vpc = typeof cfg.vpc === 'string' ? cfg.vpc : undefined;
        const vpcId = vpc ? terraformRef('aws_vpc', vpc, 'id') : 'null';
        const ingressRules = Array.isArray(cfg.ingress)
          ? cfg.ingress
              .map((rule) => {
                const ingress = rule as Record<string, unknown>;
                const port =
                  typeof ingress.port === 'number' ? ingress.port : 0;
                const protocol =
                  (ingress.protocol as string | undefined) ?? 'tcp';
                const cidr =
                  typeof ingress.cidr === 'string' ? ingress.cidr : undefined;
                const sourceSecurityGroup =
                  typeof ingress.source_security_group === 'string'
                    ? ingress.source_security_group
                    : undefined;
                const sourceLine = sourceSecurityGroup
                  ? `\n    security_groups = ${terraformStringList([
                      terraformRef(
                        'aws_security_group',
                        sourceSecurityGroup,
                        'id'
                      ),
                    ])}`
                  : cidr
                    ? `\n    cidr_blocks = ["${cidr}"]`
                    : '';

                return `  ingress {\n    from_port   = ${port}\n    to_port     = ${port}\n    protocol    = "${protocol}"${sourceLine}\n  }`;
              })
              .join('\n')
          : '';

        resources.push(
          `resource "aws_security_group" "${resourceLabel}" {\n  name        = "${service.id}"\n  description = "Managed by ADAC export-terraform"\n  vpc_id      = ${vpcId}${ingressRules ? `\n${ingressRules}` : ''}\n}`
        );

        outputs.push({
          name: `${service.id}_id`,
          description: `Security Group ID for ${service.id}`,
          value: terraformRef('aws_security_group', service.id, 'id'),
        });
      }

      if (
        service.subtype === 'application-load-balancer' ||
        service.subtype === 'alb'
      ) {
        const scheme = (cfg.scheme as string | undefined) ?? 'internet-facing';
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
        const securityGroupLine =
          securityGroups.length > 0
            ? `\n  security_groups    = ${terraformStringList(securityGroups)}`
            : '';

        resources.push(
          `resource "aws_lb" "${resourceLabel}" {\n  name               = "${service.id}"\n  internal           = ${scheme !== 'internet-facing'}\n  load_balancer_type = "application"\n  subnets            = ${terraformStringList(subnets)}${securityGroupLine}\n}`
        );

        outputs.push({
          name: `${service.id}_dns`,
          description: `DNS name for ${service.id}`,
          value: terraformRef('aws_lb', service.id, 'dns_name'),
        });
      }
    }

    if (serviceProvider === 'gcp') {
      if (
        service.subtype === 'vpc' ||
        service.subtype === 'virtual-private-cloud'
      ) {
        resources.push(
          `resource "google_compute_network" "${terraformLabel(service.id)}" {\n  name                    = "${service.id}"\n  auto_create_subnetworks = false\n}`
        );

        outputs.push({
          name: `${service.id}_id`,
          description: `VPC network ID for ${service.id}`,
          value: terraformRef('google_compute_network', service.id, 'id'),
        });
      }

      if (service.subtype === 'subnet') {
        const cidr = (cfg.cidr as string | undefined) ?? '10.0.0.0/24';

        resources.push(
          `resource "google_compute_subnetwork" "${terraformLabel(service.id)}" {\n  name          = "${service.id}"\n  ip_cidr_range = "${cidr}"\n  region        = var.gcp_region\n}`
        );

        variables.push({
          name: 'gcp_region',
          type: 'string',
          description: 'GCP region for resources',
          default: 'us-central1',
        });

        outputs.push({
          name: `${service.id}_id`,
          description: `Subnet ID for ${service.id}`,
          value: terraformRef('google_compute_subnetwork', service.id, 'id'),
        });
      }

      if (
        service.subtype === 'load-balancer' ||
        service.subtype === 'cloud-load-balancing'
      ) {
        resources.push(
          `resource "google_compute_global_address" "${terraformLabel(service.id)}" {\n  name = "${service.id}"\n}`
        );

        outputs.push({
          name: `${service.id}_address`,
          description: `Global IP for load balancer ${service.id}`,
          value: terraformRef(
            'google_compute_global_address',
            service.id,
            'address'
          ),
        });
      }
    }
  }

  return {
    resources,
    variables,
    outputs,
  };
}
