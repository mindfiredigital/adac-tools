import type { AdacConfig } from '@mindfiredigital/adac-schema';
import type {
  OptimizationRecommendation,
  OptimizationResult,
  OptimizationSummary,
  ServiceOptimizationMap,
  OptimizerOptions,
  OptimizationSeverity,
} from './types/index.js';
import { runCostRules } from './rules/cost-rules.js';
import { runSecurityRules } from './rules/security-rules.js';
import { runReliabilityRules } from './rules/reliability-rules.js';

// ─── Severity ordering (higher index = lower priority) ───────────────────────
const SEVERITY_ORDER: OptimizationSeverity[] = [
  'critical',
  'high',
  'medium',
  'low',
  'info',
];

function severityIndex(s: OptimizationSeverity): number {
  return SEVERITY_ORDER.indexOf(s);
}

/**
 * Core optimizer engine.
 *
 * Usage:
 * ```ts
 * const optimizer = new OptimizerEngine();
 * const result = optimizer.analyze(adacConfig);
 * ```
 */
export class OptimizerEngine {
  private readonly options: Required<OptimizerOptions>;

  constructor(options: OptimizerOptions = {}) {
    this.options = {
      categories: options.categories ?? [], // empty = all
      minSeverity: options.minSeverity ?? 'info',
      enableCostRules: options.enableCostRules ?? true,
      enableSecurityRules: options.enableSecurityRules ?? true,
      enableReliabilityRules: options.enableReliabilityRules ?? true,
    };
  }

  /**
   * Analyze an ADAC configuration and return optimization recommendations.
   */
  public analyze(config: AdacConfig): OptimizationResult {
    const raw: OptimizationRecommendation[] = [];

    if (this.options.enableCostRules) {
      raw.push(...runCostRules(config));
    }
    if (this.options.enableSecurityRules) {
      raw.push(...runSecurityRules(config));
    }
    if (this.options.enableReliabilityRules) {
      raw.push(...runReliabilityRules(config));
    }

    // Filter by category (if specified)
    let filtered = raw;
    if (this.options.categories.length > 0) {
      const allowed = new Set(this.options.categories);
      filtered = raw.filter((r) => allowed.has(r.category));
    }

    // Filter by minimum severity
    const minIdx = severityIndex(this.options.minSeverity);
    filtered = filtered.filter((r) => severityIndex(r.severity) <= minIdx);

    // Sort: critical → high → medium → low → info
    filtered.sort(
      (a, b) => severityIndex(a.severity) - severityIndex(b.severity)
    );

    // Build by-service map
    const byService: ServiceOptimizationMap = {};
    for (const rec of filtered) {
      for (const resourceId of rec.affectedResources) {
        if (!byService[resourceId]) {
          byService[resourceId] = [];
        }
        byService[resourceId].push(rec);
      }
    }

    // Build summary
    const summary = this.buildSummary(filtered);

    return {
      recommendations: filtered,
      byService,
      summary,
      analyzedAt: new Date().toISOString(),
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private buildSummary(
    recs: OptimizationRecommendation[]
  ): OptimizationSummary {
    const counts: OptimizationSummary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: recs.length,
      totalEstimatedSavingsUsd: 0,
    };

    for (const rec of recs) {
      counts[rec.severity]++;
      if (rec.estimatedSavingsUsd) {
        counts.totalEstimatedSavingsUsd += rec.estimatedSavingsUsd;
      }
    }

    return counts;
  }
}
