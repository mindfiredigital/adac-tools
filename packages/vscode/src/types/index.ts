/**
 * Shared types for the ADAC VS Code extension.
 */

/** ADAC service registry entry for IntelliSense */
export interface ServiceInfo {
  name: string;
  description: string;
  category: string;
  provider: 'aws' | 'gcp' | 'azure';
}

/** Validation diagnostic with positional information */
export interface AdacDiagnostic {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: 0 | 1 | 2 | 3;
}

/** ADAC key path information for context-aware completion */
export interface KeyPathContext {
  path: string[];
  depth: number;
  isArrayItem: boolean;
  parentKey: string | null;
}
