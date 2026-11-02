import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from './adac.schema.json' with { type: 'json' };
import type { AdacConfig, AdacElementLayout, AdacSize } from './types.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const AjvConstructor = Ajv as unknown as {
  new (options?: Record<string, unknown>): any;
};
const ajv = new AjvConstructor({ allErrors: true, strict: false });
const addFormatsFunc = addFormats as unknown as (a: any) => void;
/* eslint-enable @typescript-eslint/no-explicit-any */
addFormatsFunc(ajv);

const validate = ajv.compile(schema);

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
  config.applications?.forEach((a, i) =>
    visit(a?.visual, `/applications/${i}`)
  );
  config.infrastructure?.clouds?.forEach((c, ci) =>
    c?.services?.forEach((s, si) =>
      visit(s?.visual, `/infrastructure/clouds/${ci}/services/${si}`)
    )
  );
}

export function validateAdacConfig(config: unknown): ValidationResult {
  const valid = validate(config);

  const errors: string[] = [];

  if (!valid) {
    const ajvErrors = (validate.errors || []) as {
      instancePath: string;
      message?: string;
    }[];
    errors.push(
      ...(ajvErrors.map(
        (err) => `${err.instancePath} ${err.message || 'Invalid value'}`
      ) || ['Unknown schema error'])
    );
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

    typedConfig.applications?.forEach((app, index) => {
      checkId(app.id, `/applications/${index}`);
    });

    typedConfig.infrastructure?.clouds?.forEach((cloud, cloudIndex) => {
      checkId(cloud.id, `/infrastructure/clouds/${cloudIndex}`);
      cloud.services?.forEach((service, serviceIndex) => {
        checkId(
          service.id,
          `/infrastructure/clouds/${cloudIndex}/services/${serviceIndex}`
        );
      });
    });

    typedConfig.connections?.forEach((conn, index) => {
      checkId(conn.id, `/connections/${index}`);
    });
  }

  const warnings: string[] = [];
  if (config && typeof config === 'object') {
    collectLayoutChecks(config as AdacConfig, errors, warnings);
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
