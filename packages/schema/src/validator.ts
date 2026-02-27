import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from './adac.schema.json' with { type: 'json' };
import { AdacConfig } from './types.js';

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

  if (errors.length === 0) {
    return { valid: true };
  } else {
    return {
      valid: false,
      errors: errors,
    };
  }
}
