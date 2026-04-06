import { mapComputeServices } from './resources/compute-resources.js';
import { mapDatabaseServices } from './resources/database-resources.js';
import { mapNetworkingServices } from './resources/networking-resources.js';
import { mapStorageServices } from './resources/storage-resources.js';
import { hclOutput, hclString, hclVariable } from './utils/hcl-builder.js';
import { terraformLabel } from './utils/terraform-names.js';
import { parseAdac } from '@mindfiredigital/adac-parser';
import type { AdacConfig } from '@mindfiredigital/adac-schema';
import type {
  AdacService,
  CloudProvider,
  TerraformFromAdacOptions,
  TerraformGenerationResult,
  TerraformOutput,
  TerraformResourceMapping,
  TerraformVariable,
} from './types/index.js';

/**
 * Merges multiple Terraform resource mappings into a single mapping, ensuring that variables and outputs are unique by name.
 * @param mappings - An array of TerraformResourceMapping objects to merge.
 * @return A single TerraformResourceMapping containing all resources, unique variables, and unique outputs from the input mappings.
 * This function concatenates the resources from all mappings and then deduplicates variables and outputs based on their names, preserving the first occurrence.
 */
function mergeMappings(
  ...mappings: TerraformResourceMapping[]
): TerraformResourceMapping {
  const resources: string[] = [];
  const variables: TerraformVariable[] = [];
  const outputs: TerraformOutput[] = [];

  for (const m of mappings) {
    resources.push(...m.resources);
    variables.push(...m.variables);
    outputs.push(...m.outputs);
  }

  const uniqueVariables = Array.from(
    new Map(variables.map((v) => [v.name, v])).values()
  );
  const uniqueOutputs = Array.from(
    new Map(outputs.map((o) => [o.name, o])).values()
  );

  return { resources, variables: uniqueVariables, outputs: uniqueOutputs };
}

function renderProviderBlock(provider: CloudProvider, region: string): string {
  if (provider === 'gcp') {
    return `provider "google" {\n  region = "${region}"\n}`;
  }

  return `provider "aws" {\n  region = "${region}"\n}`;
}

function renderVariablesBlock(variables: TerraformVariable[]): string {
  if (variables.length === 0) return '# No variables extracted yet';
  return variables
    .map((v) => {
      const defaultValue =
        typeof v.default === 'string' ||
        typeof v.default === 'number' ||
        typeof v.default === 'boolean'
          ? v.default
          : undefined;

      return hclVariable(
        v.name,
        v.type,
        v.description,
        defaultValue,
        v.sensitive
      );
    })
    .join('\n\n');
}

function renderOutputsBlock(outputs: TerraformOutput[]): string {
  if (outputs.length === 0) return '# No outputs extracted yet';
  return outputs
    .map((o) => hclOutput(o.name, o.value, o.description))
    .join('\n\n');
}

function renderModuleValue(value: unknown): string {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).terraform === 'string'
  ) {
    return (value as Record<string, string>).terraform;
  }

  if (typeof value === 'string') {
    return hclString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    return `[\n${value
      .map((item) => `    ${renderModuleValue(item)}`)
      .join(',\n')}\n  ]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      return '{}';
    }

    return `{\n${entries
      .map(
        ([key, entryValue]) => `    ${key} = ${renderModuleValue(entryValue)}`
      )
      .join('\n')}\n  }`;
  }

  return 'null';
}

function renderModuleBlock(service: AdacService): string | undefined {
  const moduleConfig = service.config?.module;

  if (!moduleConfig || typeof moduleConfig !== 'object') {
    return undefined;
  }

  const moduleRecord = moduleConfig as Record<string, unknown>;
  const source = moduleRecord.source;

  if (typeof source !== 'string' || source.length === 0) {
    return undefined;
  }

  const inputs =
    moduleRecord.inputs && typeof moduleRecord.inputs === 'object'
      ? (moduleRecord.inputs as Record<string, unknown>)
      : {};

  const body = [
    `source = ${hclString(source)}`,
    ...Object.entries(inputs).map(
      ([key, value]) => `${key} = ${renderModuleValue(value)}`
    ),
  ].join('\n');

  return `module "${terraformLabel(service.id)}" {\n${body
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')}\n}`;
}

function mapServiceToTypeAndSubtype(
  service: Record<string, unknown>
): Pick<AdacService, 'type' | 'subtype'> {
  const type = service.type;
  const subtype = service.subtype;
  const serviceName = service.service;

  if (typeof type === 'string' && type.length > 0) {
    const normalizedType =
      type === 'network' || type === 'security' ? 'networking' : type;
    return {
      type: normalizedType,
      subtype: typeof subtype === 'string' ? subtype : undefined,
    };
  }

  if (typeof serviceName === 'string') {
    const normalized = serviceName.toLowerCase();

    if (normalized === 'cloud-storage')
      return { type: 'storage', subtype: 'gcs' };
    if (normalized === 'virtual-private-cloud')
      return { type: 'networking', subtype: 'vpc' };
    if (normalized === 'compute-engine')
      return { type: 'compute', subtype: 'compute-engine' };
    if (normalized === 'cloud-sql')
      return { type: 'database', subtype: 'cloud-sql' };
    if (normalized === 'cloud-run')
      return { type: 'compute', subtype: 'cloud-run' };
    if (normalized === 'subnet')
      return { type: 'networking', subtype: 'subnet' };
    if (normalized === 'cloud-load-balancing')
      return { type: 'networking', subtype: 'cloud-load-balancing' };
    if (normalized === 'application-load-balancer')
      return { type: 'networking', subtype: 'application-load-balancer' };
    if (normalized === 'security-group')
      return { type: 'networking', subtype: 'security-group' };
    if (normalized === 'rds-postgres')
      return { type: 'database', subtype: 'rds-postgres' };
    if (normalized === 'ecs-fargate')
      return { type: 'compute', subtype: 'ecs-fargate' };

    return { type: normalized, subtype: undefined };
  }

  return { type: 'unknown', subtype: undefined };
}

function normalizeCloudProvider(value: unknown): CloudProvider {
  return value === 'gcp' ? 'gcp' : 'aws';
}

/**
 * Normalizes services from the ADAC config based on the provided options.
 * It selects the appropriate cloud configuration and extracts services, provider, and region information.
 */
function normalizeServicesFromAdac(
  adacConfig: AdacConfig,
  options: TerraformFromAdacOptions = {}
): { services: AdacService[]; provider: CloudProvider; region: string } {
  const clouds = adacConfig.infrastructure?.clouds ?? [];

  const selectedCloud =
    (options.cloudId
      ? clouds.find((cloud) => cloud.id === options.cloudId)
      : undefined) ?? clouds[0];

  if (!selectedCloud) {
    if (!options.provider) {
      throw new Error("Provider must be specified (e.g., 'aws' or 'gcp').");
    }
    return {
      services: [],
      provider: options.provider,
      region: options.region ?? 'us-east-1',
    };
  }

  const provider =
    options.provider ?? normalizeCloudProvider(selectedCloud.provider);
  const region = options.region ?? selectedCloud.region ?? 'us-east-1';

  const services: AdacService[] = (selectedCloud.services ?? [])
    .map((service) => {
      const serviceRecord = service as unknown as Record<string, unknown>;
      const mapped = mapServiceToTypeAndSubtype(serviceRecord);

      return {
        id: String(serviceRecord.id ?? 'unnamed-service'),
        type: mapped.type,
        subtype: mapped.subtype,
        cloud: provider,
        config:
          (serviceRecord.config as Record<string, unknown> | undefined) ??
          (serviceRecord.configuration as Record<string, unknown> | undefined),
      } satisfies AdacService;
    })
    .filter((service) => service.type !== 'unknown');

  return { services, provider, region };
}

/**
 * Generates Terraform configuration from a list of ADAC services and options.
 * It processes services to create Terraform resources, variables, and outputs, and compiles them into a generation result.
 */
function generateTerraformFromServices(
  services: AdacService[],
  options: Pick<TerraformFromAdacOptions, 'provider' | 'region'> = {}
): TerraformGenerationResult {
  const provider = options.provider ?? 'aws';
  const region = options.region ?? 'us-east-1';
  const moduleServices = services.filter((service) =>
    renderModuleBlock(service)
  );
  const standardServices = services.filter(
    (service) => !renderModuleBlock(service)
  );
  const moduleResources = moduleServices
    .map((service) => renderModuleBlock(service))
    .filter((resource): resource is string => typeof resource === 'string');

  const mapping = mergeMappings(
    {
      resources: moduleResources,
      variables: [],
      outputs: [],
    },
    mapNetworkingServices(standardServices, provider),
    mapComputeServices(standardServices, provider),
    mapStorageServices(standardServices, provider),
    mapDatabaseServices(standardServices, provider)
  );

  const mainTf = [renderProviderBlock(provider, region), ...mapping.resources]
    .filter(Boolean)
    .join('\n\n');

  return {
    mainTf,
    variablesTf: renderVariablesBlock(mapping.variables),
    outputsTf: renderOutputsBlock(mapping.outputs),
    diagnostics: [
      `Provider ${provider}`,
      `Processed ${services.length} services`,
      `Generated ${mapping.resources.length} resources`,
      `Generated ${moduleResources.length} modules`,
      `Extracted ${mapping.variables.length} variables`,
      `Extracted ${mapping.outputs.length} outputs`,
    ],
  };
}

function generateTerraformFromAdacConfig(
  adacConfig: AdacConfig,
  options: TerraformFromAdacOptions = {}
): TerraformGenerationResult {
  const normalized = normalizeServicesFromAdac(adacConfig, options);

  return generateTerraformFromServices(normalized.services, {
    provider: normalized.provider,
    region: normalized.region,
  });
}

export function generateTerraformFromAdacFile(
  filePath: string,
  options: TerraformFromAdacOptions = {}
): TerraformGenerationResult {
  const adacConfig = parseAdac(filePath, {
    validate: options.validate ?? true,
  });
  return generateTerraformFromAdacConfig(adacConfig, options);
}
