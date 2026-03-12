export interface DocOptions {
  format?: DocFormat;
  sections?: DocSection[];
  includeMetadata?: boolean;
  includeCost?: boolean;
  includeCompliance?: boolean;
  template?: string;
  outputDir?: string;
}

export type DocFormat = 'markdown' | 'html' | 'pdf';

export type DocSection =
  | 'overview'
  | 'architecture'
  | 'services'
  | 'connections'
  | 'cost'
  | 'compliance'
  | 'metadata';

export interface DocOutput {
  format: DocFormat;
  files: DocFile[];
  metadata: DocMetadata;
}

export interface DocFile {
  name: string;
  content: string;
  path: string;
}

export interface DocMetadata {
  generatedAt: string;
  sections: string[];
  totalSize: number;
}
