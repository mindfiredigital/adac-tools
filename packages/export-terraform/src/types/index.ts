export type CloudProvider = 'aws' | 'gcp';

export interface AdacService {
  id: string;
  type: string;
  subtype?: string;
  cloud?: CloudProvider;
  config?: Record<string, unknown>;
}

/**
 * Represents a Terraform variable
 */
export interface TerraformVariable {
  name: string;
  type: 'string' | 'number' | 'bool' | 'list(string)' | 'map(string)';
  description?: string;
  default?: string | number | boolean | string[] | Record<string, string>;
  sensitive?: boolean;
}

/**
 * Represents a Terraform output
 */
export interface TerraformOutput {
  name: string;
  description?: string;
  value: string;
}

/**
 * Represents a single mapped resource
 */
export interface TerraformResourceMapping {
  resources: string[];
  variables: TerraformVariable[];
  outputs: TerraformOutput[];
}

/**
 * Configuration options for generation
 */
export interface TerraformGenerationOptions {
  region?: string;
  provider?: CloudProvider;
}

export interface TerraformFromAdacOptions extends TerraformGenerationOptions {
  cloudId?: string;
  validate?: boolean;
}

/**
 * Final result from generateTerraformFromAdacFile()
 * Contains the three main Terraform files
 */
export interface TerraformGenerationResult {
  mainTf: string;
  variablesTf: string;
  outputsTf: string;
  diagnostics: string[];
}
