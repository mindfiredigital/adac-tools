import type { AdacConfig } from '@mindfiredigital/adac-schema';
import { OptimizerEngine } from './optimizer.js';
import type { OptimizerOptions, OptimizationResult } from './types/index.js';

export { OptimizerEngine } from './optimizer.js';
export type {
  OptimizationRecommendation,
  OptimizationResult,
  OptimizationSummary,
  OptimizationCategory,
  OptimizationSeverity,
  OptimizerOptions,
  ServiceOptimizationMap,
} from './types/index.js';

export function analyzeOptimizations(
  config: AdacConfig,
  options?: OptimizerOptions
): OptimizationResult {
  return new OptimizerEngine(options).analyze(config);
}
