export type CloudProvider = 'aws';

export interface NormalizedAdacService {
  id: string;
  type: string;
  subtype?: string;
  cloud: CloudProvider;
  config?: Record<string, unknown>;
}

export interface CloudFormationParameter {
  Type: string;
  Description?: string;
  Default?: string | number | boolean;
  NoEcho?: boolean;
}

export interface CloudFormationOutput {
  Description?: string;
  Value: unknown;
}

export interface CloudFormationResource {
  Type: string;
  Properties?: Record<string, unknown>;
  DependsOn?: string | string[];
}

export interface CloudFormationResourceMapping {
  parameters: Record<string, CloudFormationParameter>;
  resources: Record<string, CloudFormationResource>;
  outputs: Record<string, CloudFormationOutput>;
}

export interface CloudFormationGenerationOptions {
  provider?: CloudProvider;
  region?: string;
}

export interface CloudFormationFromAdacOptions
  extends CloudFormationGenerationOptions {
  cloudId?: string;
  validate?: boolean;
}

export interface CloudFormationGenerationResult {
  templateYaml: string;
  diagnostics: string[];
}
