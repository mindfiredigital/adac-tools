
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "./adac.schema.json" with { type: "json" };
import { AdacConfig } from "./types.js";

const ajv = new (Ajv as any)({ allErrors: true, strict: false });
(addFormats as any)(ajv);

const validate = ajv.compile(schema);

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export function validateAdacConfig(config: unknown): ValidationResult {
  const valid = validate(config);
  
  const errors: string[] = [];
  
  if (!valid) {
    errors.push(...(validate.errors?.map((err: any) => `${err.instancePath} ${err.message}`) || ["Unknown schema error"]));
  }

  // Ensure instance IDs are unique across the entire configuration
  if (config && typeof config === "object") {
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
        checkId(service.id, `/infrastructure/clouds/${cloudIndex}/services/${serviceIndex}`);
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
