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

function mergeMappings(
  ...mappings: CloudFormationResourceMapping[]
): CloudFormationResourceMapping {
  return mappings.reduce<CloudFormationResourceMapping>(
    (merged, mapping) => ({
      parameters: { ...merged.parameters, ...mapping.parameters },
      resources: { ...merged.resources, ...mapping.resources },
      outputs: { ...merged.outputs, ...mapping.outputs },
    }),
    { parameters: {}, resources: {}, outputs: {} }
  );
}

function mapServiceToTypeAndSubtype(
  service: Record<string, unknown>
): Pick<NormalizedAdacService, 'type' | 'subtype'> {
  const type = service.type;
  const subtype = service.subtype;
  const serviceName = service.service;

  if (typeof type === 'string' && type.length > 0) {
    return {
      type: type === 'network' || type === 'security' ? 'networking' : type,
      subtype: typeof subtype === 'string' ? subtype : undefined,
    };
  }

  if (typeof serviceName === 'string') {
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
  const selectedCloud =
    (options.cloudId
      ? clouds.find((cloud) => cloud.id === options.cloudId)
      : undefined) ?? clouds[0];

  if (!selectedCloud) {
    return {
      services: [],
      provider: 'aws',
      region: options.region ?? 'us-east-1',
    };
  }

  const provider = 'aws';
  const region = options.region ?? selectedCloud.region ?? 'us-east-1';

  const services: NormalizedAdacService[] = (selectedCloud.services ?? [])
    .map((service) => {
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
    })
    .filter((service) => service.type !== 'unknown');

  return { services, provider, region };
}

function toYaml(value: unknown, indent: number = 0): string {
  const pad = ' '.repeat(indent);

  if (value === undefined) {
    return `${pad}null`;
  }

  if (value === null) {
    return `${pad}null`;
  }

  if (typeof value === 'string') {
    return `${pad}${JSON.stringify(value)}`;
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
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          const entries = Object.entries(item);

          if (entries.length === 0) {
            return `${pad}- {}`;
          }

          const [firstKey, firstValue] = entries[0];
          const firstLine = `${pad}- ${firstKey}:${
            firstValue !== null && typeof firstValue === 'object'
              ? `\n${toYaml(firstValue, indent + 4)}`
              : ` ${toYaml(firstValue, 0).trim()}`
          }`;
          const rest = entries
            .slice(1)
            .map(([key, entryValue]) =>
              entryValue !== null && typeof entryValue === 'object'
                ? `${' '.repeat(indent + 2)}${key}:\n${toYaml(entryValue, indent + 4)}`
                : `${' '.repeat(indent + 2)}${key}: ${toYaml(entryValue, 0).trim()}`
            )
            .join('\n');

          return rest ? `${firstLine}\n${rest}` : firstLine;
        }

        return `${pad}- ${toYaml(item, 0).trim()}`;
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
        entryValue !== null &&
        typeof entryValue === 'object' &&
        !(Array.isArray(entryValue) && entryValue.length === 0)
      ) {
        return `${pad}${key}:\n${toYaml(entryValue, indent + 2)}`;
      }

      return `${pad}${key}: ${toYaml(entryValue, 0).trim()}`;
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
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const templatePath = join(currentDir, 'templates', 'template.yaml.hbs');
  const templateContent = readFileSync(templatePath, 'utf8');

  const compiled = Handlebars.compile(templateContent);

  const paramsYaml = Object.keys(parameters).length ? toYaml(parameters, 2).trimEnd() : '';
  const resourcesYaml = Object.keys(resources).length ? toYaml(resources, 2).trimEnd() : '';
  const outputsYaml = Object.keys(outputs).length ? toYaml(outputs, 2).trimEnd() : '';

  return compiled({
    description,
    parameters: paramsYaml,
    resources: resourcesYaml,
    outputs: outputsYaml,
    networkingParameters,
    computeParameters,
    databaseParameters
  });
}

export function generateCloudFormationFromServices(
  services: NormalizedAdacService[],
  options: CloudFormationGenerationOptions = {}
): CloudFormationGenerationResult {
  const provider = options.provider ?? 'aws';
  const region = options.region ?? 'us-east-1';
  const description = `Generated CloudFormation template for ${provider} (${region})`;

  const networkingMapping = mapNetworkingServices(services);
  const computeMapping = mapComputeServices(services);
  const databaseMapping = mapDatabaseServices(services);

  const mapping = mergeMappings(
    networkingMapping,
    computeMapping,
    databaseMapping
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
