import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from './adac.schema.json' with { type: 'json' };
import type { AdacConfig, AdacElementLayout, AdacSize } from './types.js';

type JsonSchema = Record<string, unknown>;

/* eslint-disable @typescript-eslint/no-explicit-any */
const AjvConstructor = Ajv as unknown as {
  new (options?: Record<string, unknown>): any;
};
const addFormatsFunc = addFormats as unknown as (a: any) => void;
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  /** Non-fatal findings, e.g. use of deprecated layout properties. */
  warnings?: string[];
}

/** Deprecated `layoutOptions` aliases and the property that replaces them. */
export const DEPRECATED_LAYOUT_OPTION_ALIASES = {
  unit: 'unitSize',
  routing: 'edgeRouting',
} as const;

function checkSizeOrder(
  layout: AdacElementLayout,
  path: string,
  errors: string[]
): void {
  const dims = ['width', 'height'] as const;
  const pairs: [keyof AdacElementLayout, keyof AdacElementLayout][] = [
    ['minSize', 'maxSize'],
    ['minSize', 'size'],
    ['size', 'maxSize'],
  ];
  for (const [lowKey, highKey] of pairs) {
    const low = layout[lowKey] as AdacSize | undefined;
    const high = layout[highKey] as AdacSize | undefined;
    if (!low || !high) continue;
    for (const dim of dims) {
      const l = low[dim];
      const h = high[dim];
      if (typeof l === 'number' && typeof h === 'number' && l > h) {
        errors.push(
          `${path}/${lowKey}/${dim} (${l}) must not exceed ${highKey}/${dim} (${h})`
        );
      }
    }
  }
}

function collectLayoutChecks(
  config: AdacConfig,
  errors: string[],
  warnings: string[]
): void {
  const options = config.layoutOptions;
  if (options && typeof options === 'object') {
    for (const [alias, replacement] of Object.entries(
      DEPRECATED_LAYOUT_OPTION_ALIASES
    )) {
      if (alias in options) {
        warnings.push(
          `/layoutOptions/${alias} is deprecated; use ${replacement}`
        );
        if (replacement in options) {
          warnings.push(
            `/layoutOptions defines both ${alias} and ${replacement}; ${replacement} wins`
          );
        }
      }
    }
  }

  const visit = (
    visual: { layout?: AdacElementLayout } | undefined,
    p: string
  ) => {
    if (visual?.layout && typeof visual.layout === 'object') {
      checkSizeOrder(visual.layout, `${p}/visual/layout`, errors);
    }
  };
  // the document may be malformed (validation has not rejected it yet)
  if (Array.isArray(config.applications)) {
    config.applications.forEach((a, i) =>
      visit(a?.visual, `/applications/${i}`)
    );
  }
  const clouds = config.infrastructure?.clouds;
  if (Array.isArray(clouds)) {
    clouds.forEach((c, ci) => {
      if (!Array.isArray(c?.services)) return;
      c.services.forEach((s, si) =>
        visit(s?.visual, `/infrastructure/clouds/${ci}/services/${si}`)
      );
    });
  }
}

export interface ValidationExtension {
  name: string;
  rootProperties?: Record<string, JsonSchema>;
  awsServiceProperties?: Record<string, JsonSchema>;
  gcpServiceProperties?: Record<string, JsonSchema>;
  validate?: (config: unknown) => string[];
}

export interface ValidationOptions {
  extensions?: ValidationExtension[];
}

function createAjv() {
  const ajv = new AjvConstructor({ allErrors: true, strict: false });
  addFormatsFunc(ajv);
  return ajv;
}

function cloneSchema(): JsonSchema {
  return JSON.parse(JSON.stringify(schema)) as JsonSchema;
}

function getSchemaObject(source: JsonSchema, path: string[]): JsonSchema {
  let current = source;

  for (const segment of path) {
    const value = current[segment];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Invalid ADAC schema path: ${path.join('.')}`);
    }
    current = value as JsonSchema;
  }

  return current;
}

function extendProperties(
  target: JsonSchema,
  properties: Record<string, JsonSchema> | undefined
) {
  if (!properties) {
    return;
  }

  const existingProperties =
    (target.properties as Record<string, JsonSchema> | undefined) ?? {};

  for (const key of Object.keys(properties)) {
    if (key in existingProperties) {
      throw new Error(
        `Extension cannot override core ADAC schema property: ${key}`
      );
    }
  }

  target.properties = {
    ...existingProperties,
    ...properties,
  };
}

function buildValidator(extensions: ValidationExtension[] = []) {
  const schemaToCompile = cloneSchema();
  const defs = getSchemaObject(schemaToCompile, ['$defs']);
  const awsService = getSchemaObject(defs, ['aws_service']);
  const gcpService = getSchemaObject(defs, ['gcp_service']);

  for (const extension of extensions) {
    extendProperties(schemaToCompile, extension.rootProperties);
    extendProperties(awsService, extension.awsServiceProperties);
    extendProperties(gcpService, extension.gcpServiceProperties);
  }

  return createAjv().compile(schemaToCompile);
}

const baseValidate = buildValidator();

export function validateAdacConfig(
  config: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const validate =
    options.extensions && options.extensions.length > 0
      ? buildValidator(options.extensions)
      : baseValidate;
  const valid = validate(config);

  const errors: string[] = [];

  if (!valid) {
    const ajvErrors = (validate.errors || []) as {
      instancePath: string;
      message?: string;
      keyword?: string;
      params?: Record<string, unknown>;
    }[];

    // Ignore legacy 'cost' fields when validating without the cost extension
    const filteredErrors = ajvErrors.filter(
      (err) =>
        !(
          err.keyword === 'additionalProperties' &&
          err.params?.additionalProperty === 'cost'
        )
    );

    if (filteredErrors.length > 0) {
      errors.push(
        ...filteredErrors.map(
          (err) => `${err.instancePath} ${err.message || 'Invalid value'}`
        )
      );
    }
  }

  // Ensure instance IDs are unique across the entire configuration
  if (config && typeof config === 'object') {
    const typedConfig = config as AdacConfig;
    const allIds = new Set<string>();

    const checkId = (id: string | undefined, path: string) => {
      if (id) {
        if (allIds.has(id)) {
          errors.push(`${path} ID "${id}" is not unique`);
        }
        allIds.add(id);
      }
    };

    if (Array.isArray(typedConfig.applications)) {
      typedConfig.applications.forEach((app, index) => {
        checkId(app?.id, `/applications/${index}`);
      });
    }

    if (
      typedConfig.infrastructure &&
      Array.isArray(typedConfig.infrastructure.clouds)
    ) {
      typedConfig.infrastructure.clouds.forEach((cloud, cloudIndex) => {
        checkId(cloud?.id, `/infrastructure/clouds/${cloudIndex}`);
        if (cloud && Array.isArray(cloud.services)) {
          cloud.services.forEach((service, serviceIndex) => {
            checkId(
              service?.id,
              `/infrastructure/clouds/${cloudIndex}/services/${serviceIndex}`
            );
          });
        }
      });
    }

    if (Array.isArray(typedConfig.connections)) {
      typedConfig.connections.forEach((conn, index) => {
        checkId(conn?.id, `/connections/${index}`);
      });
    }
  }

  const warnings: string[] = [];
  if (config && typeof config === 'object') {
    collectLayoutChecks(config as AdacConfig, errors, warnings);
  }

  for (const extension of options.extensions ?? []) {
    errors.push(...(extension.validate?.(config) ?? []));
  }

  const withWarnings = warnings.length > 0 ? { warnings } : {};

  if (errors.length === 0) {
    return { valid: true, ...withWarnings };
  } else {
    return {
      valid: false,
      errors: errors,
      ...withWarnings,
    };
  }
}
