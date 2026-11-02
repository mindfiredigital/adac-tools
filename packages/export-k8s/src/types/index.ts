export type K8sLabels = Record<string, string>;

export interface K8sObjectMeta {
  name: string;
  namespace?: string;
  labels?: K8sLabels;
  annotations?: K8sLabels;
}

export interface K8sManifest {
  apiVersion: string;
  kind: string;
  metadata: K8sObjectMeta;
  [key: string]: unknown;
}

export type K8sWorkloadKind =
  'deployment' | 'service' | 'ingress' | 'configmap' | 'secret';

export interface NormalizedK8sService {
  id: string;
  name?: string;
  type?: string;
  subtype?: string;
  kind: K8sWorkloadKind;
  k8sName: string;
  namespace: string;
  runs: string[];
  config: Record<string, unknown>;
  tags: Record<string, string>;
}

export interface K8sGenerationOptions {
  cloudId?: string;
  namespace?: string;
  includeNamespaceManifests?: boolean;
  validate?: boolean;
}

export type K8sFromAdacOptions = K8sGenerationOptions;

export interface K8sGenerationResult {
  yaml: string;
  manifests: K8sManifest[];
  namespaces: string[];
  diagnostics: string[];
}
