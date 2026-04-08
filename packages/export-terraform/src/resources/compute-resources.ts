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

type EcsContainerConfig = {
  name?: unknown;
  image?: unknown;
  port?: unknown;
  cpu?: unknown;
  memory?: unknown;
  essential?: unknown;
  environment?: unknown;
};

/**
 * Converts an array of container configs into ECS-compatible container definitions JSON.
 */
function toEcsContainerDefinitions(value: unknown, serviceId: string): string {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `ECS service "${serviceId}" must define at least one container with a valid image.`
    );
  }

  const definitions = value.map((container, index) => {
    if (typeof container !== 'object' || container === null) {
      throw new Error(
        `ECS service "${serviceId}" contains an invalid container entry at index ${index}.`
      );
    }

    const typedContainer = container as EcsContainerConfig;

    if (
      typeof typedContainer.image !== 'string' ||
      typedContainer.image.trim().length === 0
    ) {
      throw new Error(
        `ECS service "${serviceId}" container at index ${index} must define a non-empty image.`
      );
    }

    const definition: Record<string, unknown> = {
      name:
        typeof typedContainer.name === 'string' &&
        typedContainer.name.length > 0
          ? typedContainer.name
          : `${serviceId}-${index + 1}`,
      image: typedContainer.image,
      essential:
        typeof typedContainer.essential === 'boolean'
          ? typedContainer.essential
          : true,
    };

    if (typeof typedContainer.cpu === 'number') {
      definition.cpu = typedContainer.cpu;
    }

    if (typeof typedContainer.memory === 'number') {
      definition.memory = typedContainer.memory;
    }

    if (typeof typedContainer.port === 'number') {
      definition.portMappings = [
        {
          containerPort: typedContainer.port,
          hostPort: typedContainer.port,
          protocol: 'tcp',
        },
      ];
    }

    if (Array.isArray(typedContainer.environment)) {
      const environment = typedContainer.environment
        .filter(
          (
            item
          ): item is {
            name?: unknown;
            value?: unknown;
          } => typeof item === 'object' && item !== null
        )
        .map((item) => ({
          name:
            typeof item.name === 'string' && item.name.length > 0
              ? item.name
              : undefined,
          value:
            typeof item.value === 'string' ||
            typeof item.value === 'number' ||
            typeof item.value === 'boolean'
              ? String(item.value)
              : '',
        }))
        .filter((item) => item.name);

      if (environment.length > 0) {
        definition.environment = environment;
      }
    }

    return definition;
  });

  return JSON.stringify(definitions, null, 2);
}

/**
 * Maps ADAC compute services to Terraform resource, variable, and output blocks.
 * Handles AWS EC2, ECS Fargate, Lambda, and GCP Compute Engine, Cloud Run.
 */
export function mapComputeServices(
  services: AdacService[],
  provider: CloudProvider
): TerraformResourceMapping {
  const resources: string[] = [];
  const variables: TerraformVariable[] = [];
  const outputs: TerraformOutput[] = [];

  for (const service of services) {
    if (service.type !== 'compute') {
      continue;
    }

    const serviceProvider = service.cloud ?? provider;
    const resourceLabel = terraformLabel(service.id);

    if (serviceProvider === 'aws' && service.subtype === 'ec2') {
      const instanceType =
        (service.config?.instance_class as string | undefined) ?? 't3.micro';
      const amiVariableName = `${resourceLabel}_ami`;
      const instanceTypeVariableName = `${resourceLabel}_instance_type`;

      resources.push(
        `resource "aws_instance" "${resourceLabel}" {\n  ami           = var.${amiVariableName}\n  instance_type = var.${instanceTypeVariableName}\n}`
      );

      variables.push({
        name: amiVariableName,
        type: 'string',
        description: `AMI for ${service.id}`,
      });

      variables.push({
        name: instanceTypeVariableName,
        type: 'string',
        description: `Instance type for ${service.id}`,
        default: instanceType,
      });

      outputs.push({
        name: `${service.id}_id`,
        description: `Instance ID for ${service.id}`,
        value: terraformRef('aws_instance', resourceLabel, 'id'),
      });
    }

    if (
      serviceProvider === 'gcp' &&
      (service.subtype === 'gce' || service.subtype === 'compute-engine')
    ) {
      const machineType =
        (service.config?.machine_type as string | undefined) ?? 'e2-micro';

      resources.push(
        `resource "google_compute_instance" "${resourceLabel}" {\n  name         = "${service.id}"\n  machine_type = "${machineType}"\n\n  boot_disk {\n    initialize_params {\n      image = var.gce_image\n    }\n  }\n\n  network_interface {\n    network = "default"\n    access_config {}\n  }\n}`
      );

      variables.push({
        name: 'gce_image',
        type: 'string',
        description: 'Boot image for GCP compute instances',
        default: 'debian-cloud/debian-12',
      });

      outputs.push({
        name: `${service.id}_id`,
        description: `Instance ID for ${service.id}`,
        value: terraformRef(
          'google_compute_instance',
          resourceLabel,
          'instance_id'
        ),
      });
    }

    if (serviceProvider === 'aws' && service.subtype === 'ecs-fargate') {
      const cpu = (service.config?.cpu as number | undefined) ?? 256;
      const memory = (service.config?.memory as number | undefined) ?? 512;
      const desiredCount =
        (service.config?.desired_count as number | undefined) ?? 1;
      const containerDefinitions = toEcsContainerDefinitions(
        service.config?.containers,
        service.id
      );
      const subnets = Array.isArray(service.config?.subnets)
        ? service.config.subnets
            .filter((subnet): subnet is string => typeof subnet === 'string')
            .map((subnet) => terraformRef('aws_subnet', subnet, 'id'))
        : [];
      if (subnets.length === 0) {
        throw new Error(
          `ECS service "${service.id}" must define at least one subnet for awsvpc network mode.`
        );
      }
      const securityGroups = Array.isArray(service.config?.security_groups)
        ? service.config.security_groups
            .filter((sg): sg is string => typeof sg === 'string')
            .map((sg) => terraformRef('aws_security_group', sg, 'id'))
        : [];
      const networkConfiguration = `  network_configuration {\n    subnets          = ${terraformStringList(subnets)}\n    security_groups  = ${terraformStringList(securityGroups)}\n    assign_public_ip = false\n  }`;

      resources.push(
        `resource "aws_ecs_cluster" "${resourceLabel}_cluster" {\n  name = "${service.id}-cluster"\n}\n\nresource "aws_ecs_task_definition" "${resourceLabel}" {\n  family                   = "${service.id}"\n  requires_compatibilities = ["FARGATE"]\n  network_mode             = "awsvpc"\n  cpu                      = "${cpu}"\n  memory                   = "${memory}"\n  container_definitions    = <<DEFINITIONS\n${containerDefinitions}\nDEFINITIONS\n}\n\nresource "aws_ecs_service" "${resourceLabel}" {\n  name            = "${service.id}"\n  cluster         = ${terraformRef('aws_ecs_cluster', `${resourceLabel}_cluster`, 'id')}\n  task_definition = ${terraformRef('aws_ecs_task_definition', resourceLabel, 'arn')}\n  desired_count   = ${desiredCount}\n  launch_type     = "FARGATE"\n${networkConfiguration}\n}`
      );

      outputs.push({
        name: `${service.id}_cluster_arn`,
        description: `ECS Cluster ARN for ${service.id}`,
        value: terraformRef(
          'aws_ecs_cluster',
          `${resourceLabel}_cluster`,
          'arn'
        ),
      });
    }

    if (serviceProvider === 'aws' && service.subtype === 'lambda') {
      const handler =
        (service.config?.handler as string | undefined) ?? 'index.handler';
      const runtime =
        (service.config?.runtime as string | undefined) ?? 'nodejs20.x';
      const timeout = (service.config?.timeout as number | undefined) ?? 30;
      const filenameVariableName = `${resourceLabel}_filename`;
      const roleVariableName = `${resourceLabel}_role_arn`;

      resources.push(
        `resource "aws_lambda_function" "${resourceLabel}" {\n  function_name = "${service.id}"\n  filename      = var.${filenameVariableName}\n  role          = var.${roleVariableName}\n  handler       = "${handler}"\n  runtime       = "${runtime}"\n  timeout       = ${timeout}\n}`
      );

      variables.push({
        name: filenameVariableName,
        type: 'string',
        description: `Deployment package path for ${service.id}`,
      });

      variables.push({
        name: roleVariableName,
        type: 'string',
        description: `IAM role ARN for ${service.id}`,
      });

      outputs.push({
        name: `${service.id}_arn`,
        description: `Lambda ARN for ${service.id}`,
        value: terraformRef('aws_lambda_function', resourceLabel, 'arn'),
      });
    }

    if (serviceProvider === 'gcp' && service.subtype === 'cloud-run') {
      const maxInstances =
        (service.config?.max_instances as number | undefined) ?? 10;

      resources.push(
        `resource "google_cloud_run_v2_service" "${resourceLabel}" {\n  name     = "${service.id}"\n  location = var.gcp_region\n\n  template {\n    scaling {\n      max_instance_count = ${maxInstances}\n    }\n    containers {\n      image = "us-docker.pkg.dev/cloudrun/container/hello"\n    }\n  }\n}`
      );

      variables.push({
        name: 'gcp_region',
        type: 'string',
        description: 'GCP region for resources',
        default: 'us-central1',
      });

      outputs.push({
        name: `${service.id}_url`,
        description: `Cloud Run URL for ${service.id}`,
        value: terraformRef(
          'google_cloud_run_v2_service',
          resourceLabel,
          'uri'
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
