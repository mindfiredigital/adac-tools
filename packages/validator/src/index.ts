import { AdacConfig } from './types.js';
import {
  deprecatedLayoutOptionWarning,
  validateAdacConfig,
  ValidationExtension,
  ValidationOptions,
  ValidationResult,
} from './validator.js';

type AdacService =
  AdacConfig['infrastructure']['clouds'][number]['services'][number];

export { validateAdacConfig, deprecatedLayoutOptionWarning };
export {
  collectDeclaredLayoutProperties,
  declaredLayoutEngine,
  unsupportedLayoutEngineWarning,
  VPC_BOUND_TYPES,
  type AdacLayoutEngineName,
  type DeclaredLayoutProperties,
} from './layout-support.js';

export type {
  AdacConfig,
  AdacService,
  ValidationExtension,
  ValidationOptions,
  ValidationResult,
};

// layout and styling types used by the layout engines
export type * from './types.js';
