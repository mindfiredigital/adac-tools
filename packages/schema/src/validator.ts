
import Ajv from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "./adac.schema.json";
import { AdacConfig } from "./index.js";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validate = ajv.compile(schema);

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export function validateAdacConfig(config: unknown): ValidationResult {
  const valid = validate(config);
  if (valid) {
    return { valid: true };
  } else {
    return {
      valid: false,
      errors: validate.errors?.map((err) => `${err.instancePath} ${err.message}`) || ["Unknown error"],
    };
  }
}
