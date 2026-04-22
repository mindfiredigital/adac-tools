// ─── Public API ───────────────────────────────────────────────────────────────
export { OptimizerEngine } from './optimizer.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  OptimizationRecommendation,
  OptimizationResult,
  OptimizationSummary,
  OptimizationCategory,
  OptimizationSeverity,
  OptimizerOptions,
  ServiceOptimizationMap,
} from './types/index.js';

// ─── Convenience function ─────────────────────────────────────────────────────
import type { AdacConfig } from '@mindfiredigital/adac-schema';
import { OptimizerEngine } from './optimizer.js';
import type { OptimizerOptions, OptimizationResult } from './types/index.js';

/**
 * Analyse an ADAC configuration and return optimisation recommendations.
 *
 * This is a convenience wrapper around `new OptimizerEngine().analyze(config)`.
 *
 * @example
 * ```ts
 * import { analyzeOptimizations } from '@mindfiredigital/adac-optimizer';
 * const result = analyzeOptimizations(config);
 * console.log(result.summary);
 * ```
 */
export function analyzeOptimizations(
  config: AdacConfig,
  options?: OptimizerOptions
): OptimizationResult {
  const engine = new OptimizerEngine(options);
  return engine.analyze(config);
}
