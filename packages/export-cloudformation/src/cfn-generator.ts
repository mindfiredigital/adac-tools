import { readFileSync } from 'fs';
import Handlebars from 'handlebars';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parseAdac, parseAdacFromContent } from '@mindfiredigital/adac-parser';
import type { AdacConfig } from '@mindfiredigital/adac-schema';
import { mapComputeServices } from './resources/compute-resources.js';
import { mapDatabaseServices } from './resources/database-resources.js';
import { mapNetworkingServices } from './resources/networking-resources.js';
import type {
  CloudFormationFromAdacOptions,
  CloudFormationGenerationOptions,
  CloudFormationGenerationResult,
  CloudFormationOutput,
  CloudFormationParameter,
  CloudFormationResource,
  CloudFormationResourceMapping,
  CloudProvider,
  NormalizedAdacService,
} from './types/index.js';

type NamedMapping = {
  name: string;
  mapping: CloudFormationResourceMapping;
};

const currentDir = dirname(fileURLToPath(import.meta.url));
const templatePath = join(currentDir, 'templates', 'template.yaml.hbs');
const templateContent = readFileSync(templatePath, 'utf8');
const compiledTemplate = Handlebars.compile(templateContent);

function mergeMappings(
  ...namedMappings: NamedMapping[]
): CloudFormationResourceMapping & { diagnostics: string[] } {
  const merged: CloudFormationResourceMapping & { diagnostics: string[] } = {
    parameters: {},
    resources: {},
    outputs: {},
    diagnostics: [],
  };
  const parameterOwners = new Map<string, string>();
  const resourceOwners = new Map<string, string>();
  const outputOwners = new Map<string, string>();

  const mergeBucket = <T>(
    kind: 'parameters' | 'resources' | 'outputs',
    source: Record<string, T>,
    destination: Record<string, T>,
    owners: Map<string, string>,
    mappingName: string
  ) => {
    for (const [key, value] of Object.entries(source)) {
      const existingOwner = owners.get(key);
      if (existingOwner) {
        throw new Error(
          `Duplicate CloudFormation ${kind} key "${key}" emitted by ${mappingName}; already emitted by ${existingOwner}.`
        );
      }

      owners.set(key, mappingName);
      destination[key] = value;
    }
  };

  for (const { name, mapping } of namedMappings) {
    mergeBucket(
      'parameters',
      mapping.parameters,
      merged.parameters,
      parameterOwners,
      name
    );
    mergeBucket(
      'resources',
      mapping.resources,
      merged.resources,
      resourceOwners,
      name
    );
    mergeBucket('outputs', mapping.outputs, merged.outputs, outputOwners, name);

    if (Array.isArray(mapping.diagnostics)) {
      merged.diagnostics.push(...mapping.diagnostics);
    }
  }

  return merged;
}

function mapServiceToTypeAndSubtype(
  service: Record<string, unknown>
): Pick<NormalizedAdacService, 'type' | 'subtype'> {
  const type = service.type;
  const subtype = service.subtype;
  const serviceName = service.service;

  if (typeof type === 'string' && type.length > 0) {
    const normalizedType = type.toLowerCase();
    return {
      type:
        normalizedType === 'network' || normalizedType === 'security'
          ? 'networking'
          : normalizedType,
      subtype:
        typeof subtype === 'string' && subtype.length > 0
          ? subtype.toLowerCase()
          : undefined,
    };
  }

  if (typeof serviceName === 'string' && serviceName.length > 0) {
    const normalized = serviceName.toLowerCase();

    if (normalized === 'application-load-balancer') {
      return { type: 'networking', subtype: 'application-load-balancer' };
    }
    if (normalized === 'security-group') {
      return { type: 'networking', subtype: 'security-group' };
    }
    if (normalized === 'ecs-fargate') {
      return { type: 'compute', subtype: 'ecs-fargate' };
    }
    if (normalized === 'lambda') {
      return { type: 'compute', subtype: 'lambda' };
    }
    if (normalized === 'rds-postgres') {
      return { type: 'database', subtype: 'rds-postgres' };
    }
    if (normalized === 'dynamodb') {
      return { type: 'database', subtype: 'dynamodb' };
    }

    return { type: normalized, subtype: undefined };
  }

  return { type: 'unknown', subtype: undefined };
}

function normalizeServicesFromAdac(
  adacConfig: AdacConfig,
  options: CloudFormationFromAdacOptions = {}
): {
  services: NormalizedAdacService[];
  provider: CloudProvider;
  region: string;
} {
  const clouds = adacConfig.infrastructure?.clouds ?? [];

  if (options.cloudId) {
    const matchingCloud = clouds.find((cloud) => cloud.id === options.cloudId);
    if (!matchingCloud) {
      const availableCloudIds = clouds.map((cloud) => cloud.id).join(', ');
      throw new Error(
        `Cloud "${options.cloudId}" was not found in ADAC config. Available clouds: ${availableCloudIds || 'none'}.`
      );
    }
  }

  const selectedCloud = options.cloudId
    ? clouds.find((cloud) => cloud.id === options.cloudId)
    : clouds[0];

  if (!selectedCloud) {
    return {
      services: [],
      provider: 'aws',
      region: options.region ?? 'us-east-1',
    };
  }

  const provider = 'aws';
  const region = options.region ?? selectedCloud.region ?? 'us-east-1';

  const services: NormalizedAdacService[] = (selectedCloud.services ?? []).map(
    (service) => {
      const record = service as unknown as Record<string, unknown>;
      const mapped = mapServiceToTypeAndSubtype(record);

      return {
        id: String(record.id ?? 'UnnamedService'),
        type: mapped.type,
        subtype: mapped.subtype,
        cloud: provider,
        config:
          (record.config as Record<string, unknown> | undefined) ??
          (record.configuration as Record<string, unknown> | undefined),
      } satisfies NormalizedAdacService;
    }
  );

  return { services, provider, region };
}

function escapeYamlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function toYaml(value: unknown, indent: number = 0): string {
  const pad = ' '.repeat(indent);

  if (value === undefined || value === null) {
    return `${pad}null`;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/\r\n/g, '\n');
    if (normalized.includes('\n')) {
      const lines = normalized.split('\n');
      return `${pad}|\n${lines.map((line) => `${' '.repeat(indent + 2)}${line}`).join('\n')}`;
    }
    return `${pad}${escapeYamlString(normalized)}`;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return `${pad}${String(value)}`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${pad}[]`;
    }

    return value
      .map((item) => {
        const isInlineScalar =
          item === null ||
          item === undefined ||
          typeof item === 'number' ||
          typeof item === 'boolean' ||
          (typeof item === 'string' &&
            !item.replace(/\r\n/g, '\n').includes('\n'));

        if (isInlineScalar) {
          return `${pad}- ${toYaml(item, 0).trim()}`;
        }

        return `${pad}-\n${toYaml(item, indent + 2)}`;
      })
      .join('\n');
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, entryValue]) => entryValue !== undefined
  );

  if (entries.length === 0) {
    return `${pad}{}`;
  }

  return entries
    .map(([key, entryValue]) => {
      if (
        typeof entryValue === 'string' &&
        entryValue.replace(/\r\n/g, '\n').includes('\n')
      ) {
        const normalized = entryValue.replace(/\r\n/g, '\n');
        const lines = normalized.split('\n');
        return `${pad}${key}: |\n${lines.map((line) => `${' '.repeat(indent + 2)}${line}`).join('\n')}`;
      }

      const shouldInline =
        entryValue === null ||
        typeof entryValue === 'number' ||
        typeof entryValue === 'boolean' ||
        (typeof entryValue === 'string' &&
          !entryValue.replace(/\r\n/g, '\n').includes('\n')) ||
        (Array.isArray(entryValue) && entryValue.length === 0);

      if (shouldInline) {
        return `${pad}${key}: ${toYaml(entryValue, 0).trim()}`;
      }

      return `${pad}${key}:\n${toYaml(entryValue, indent + 2)}`;
    })
    .join('\n');
}

function buildTemplate(
  description: string,
  parameters: Record<string, CloudFormationParameter>,
  resources: Record<string, CloudFormationResource>,
  outputs: Record<string, CloudFormationOutput>,
  networkingParameters: string[],
  computeParameters: string[],
  databaseParameters: string[]
): string {
  const paramsYaml = Object.keys(parameters).length
    ? toYaml(parameters, 2).trimEnd()
    : '';
  const resourcesYaml = Object.keys(resources).length
    ? toYaml(resources, 2).trimEnd()
    : '';
  const outputsYaml = Object.keys(outputs).length
    ? toYaml(outputs, 2).trimEnd()
    : '';

  return compiledTemplate({
    descriptionYaml: toYaml(description, 0).trim(),
    hasParameterGroups:
      networkingParameters.length > 0 ||
      computeParameters.length > 0 ||
      databaseParameters.length > 0,
    parameters: paramsYaml,
    resources: resourcesYaml,
    outputs: outputsYaml,
    networkingParameters,
    computeParameters,
    databaseParameters,
  });
}

function isSupportedService(service: NormalizedAdacService): boolean {
  if (service.type === 'networking') {
    return (
      service.subtype === 'vpc' ||
      service.subtype === 'subnet' ||
      service.subtype === 'security-group' ||
      service.subtype === 'application-load-balancer' ||
      service.subtype === 'alb'
    );
  }

  if (service.type === 'compute') {
    return (
      service.subtype === 'ec2' ||
      service.subtype === 'ecs-fargate' ||
      service.subtype === 'lambda'
    );
  }

  if (service.type === 'database') {
    return service.subtype === 'rds-postgres' || service.subtype === 'dynamodb';
  }

  return false;
}

function unsupportedServiceDiagnostic(service: NormalizedAdacService): string {
  return `Unsupported CloudFormation service "${service.id}" with type "${service.type}" and subtype "${service.subtype ?? 'none'}" was not mapped.`;
}

export function generateCloudFormationFromServices(
  services: NormalizedAdacService[],
  options: CloudFormationGenerationOptions = {}
): CloudFormationGenerationResult {
  const provider = options.provider ?? 'aws';
  const region = options.region ?? 'us-east-1';
  const description = `Generated CloudFormation template for ${provider} (${region})`;

  const unsupportedDiagnostics = services
    .filter((service) => !isSupportedService(service))
    .map(unsupportedServiceDiagnostic);
  const supportedServices = services.filter(isSupportedService);

  const networkingMapping = mapNetworkingServices(supportedServices);
  const computeMapping = mapComputeServices(supportedServices);
  const databaseMapping = mapDatabaseServices(supportedServices);

  const mapping = mergeMappings(
    { name: 'mapNetworkingServices', mapping: networkingMapping },
    { name: 'mapComputeServices', mapping: computeMapping },
    { name: 'mapDatabaseServices', mapping: databaseMapping }
  );

  return {
    templateYaml: buildTemplate(
      description,
      mapping.parameters,
      mapping.resources,
      mapping.outputs,
      Object.keys(networkingMapping.parameters),
      Object.keys(computeMapping.parameters),
      Object.keys(databaseMapping.parameters)
    ),
    diagnostics: [
      `Provider ${provider}`,
      `Processed ${services.length} services`,
      `Generated ${Object.keys(mapping.resources).length} resources`,
      `Generated ${Object.keys(mapping.parameters).length} parameters`,
      `Generated ${Object.keys(mapping.outputs).length} outputs`,
      ...mapping.diagnostics,
      ...unsupportedDiagnostics,
    ],
  };
}

export function generateCloudFormationFromAdacConfig(
  adacConfig: AdacConfig,
  options: CloudFormationFromAdacOptions = {}
): CloudFormationGenerationResult {
  const normalized = normalizeServicesFromAdac(adacConfig, options);

  return generateCloudFormationFromServices(normalized.services, {
    provider: normalized.provider,
    region: normalized.region,
  });
}

export function generateCloudFormationFromAdacFile(
  filePath: string,
  options: CloudFormationFromAdacOptions = {}
): CloudFormationGenerationResult {
  const adacConfig = parseAdac(filePath, {
    validate: options.validate ?? true,
  });

  return generateCloudFormationFromAdacConfig(adacConfig, options);
}

export function generateCloudFormationFromAdacContent(
  content: string,
  options: CloudFormationFromAdacOptions = {}
): CloudFormationGenerationResult {
  const adacConfig = parseAdacFromContent(content, {
    validate: options.validate ?? true,
  });

  return generateCloudFormationFromAdacConfig(adacConfig, options);
}
