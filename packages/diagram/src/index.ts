// Entry point for @mindfiredigital/adac-diagram
export type {
  GenerationResult,
  ComplianceTooltipMap,
  ComplianceTooltipProvider,
} from '@mindfiredigital/adac-core';
export { generateDiagram, generateDiagramSvg } from './generator.js';
export { parseAdac, parseAdacFromContent } from '@mindfiredigital/adac-parser';
export {
  validateAdacConfig,
  type AdacConfig,
} from '@mindfiredigital/adac-validator';
export {
  analyzeOptimizations,
  OptimizerEngine,
} from '@mindfiredigital/adac-layout-core';
export { buildElkGraph } from '@mindfiredigital/adac-layout-elk';
export {
  ComplianceChecker,
  type ComplianceResult,
} from '@mindfiredigital/adac-compliance';
export {
  CostCalculator,
  mapAdacServicesToCostConfig,
  type AggregatedCost as CostResult,
} from '@mindfiredigital/adac-cost';
export {
  generateCloudFormationFromAdacConfig,
  generateCloudFormationFromAdacFile,
} from '@mindfiredigital/adac-export-cloudformation';
export {
  generateK8sManifestsFromAdacConfig,
  generateK8sManifestsFromAdacFile,
} from '@mindfiredigital/adac-export-k8s';
export { generateTerraformFromAdacFile } from '@mindfiredigital/adac-export-terraform';
