import type { AdacConfig } from '@mindfiredigital/adac-validator';
import { OptimizerEngine } from './optimizer';
import type { OptimizerOptions, OptimizationResult } from './types/index';

export { OptimizerEngine } from './optimizer';
export type {
  OptimizationRecommendation,
  OptimizationResult,
  OptimizationSummary,
  OptimizationCategory,
  OptimizationSeverity,
  OptimizerOptions,
  ServiceOptimizationMap,
} from './types/index';

export function analyzeOptimizations(
  config: AdacConfig,
  options?: OptimizerOptions
): OptimizationResult {
  return new OptimizerEngine(options).analyze(config);
}
