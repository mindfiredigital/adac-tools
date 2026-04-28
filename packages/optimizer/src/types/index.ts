// ─── Severity levels ────────────────────────────────────────────────────────
export type OptimizationSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'info';

// ─── Optimization categories ─────────────────────────────────────────────────
export type OptimizationCategory =
  | 'cost'
  | 'performance'
  | 'reliability'
  | 'security'
  | 'scalability'
  | 'architecture';

// ─── Single recommendation ────────────────────────────────────────────────────
export interface OptimizationRecommendation {
  /** Unique identifier for this recommendation */
  id: string;
  /** Human-readable title */
  title: string;
  /** Detailed description of the issue and suggested fix */
  description: string;
  /** Category this recommendation belongs to */
  category: OptimizationCategory;
  /** Severity / importance of the recommendation */
  severity: OptimizationSeverity;
  /** IDs of the services or resources affected */
  affectedResources: string[];
  /** Optional estimated monthly cost savings in USD */
  estimatedSavingsUsd?: number;
  /** Action steps the user should take */
  actionItems: string[];
  /** External link for more context (docs, pricing pages, etc.) */
  referenceUrl?: string;
}

// ─── Per-service recommendation map ──────────────────────────────────────────
export type ServiceOptimizationMap = Record<
  string,
  OptimizationRecommendation[]
>;

// ─── Summary counts ──────────────────────────────────────────────────────────
export interface OptimizationSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
  /** Total estimated monthly savings across all recommendations */
  totalEstimatedSavingsUsd: number;
}

// ─── Top-level result returned by OptimizerEngine ────────────────────────────
export interface OptimizationResult {
  /** Flat list of all recommendations */
  recommendations: OptimizationRecommendation[];
  /** Recommendations grouped by serviceId */
  byService: ServiceOptimizationMap;
  /** Aggregated counts and savings */
  summary: OptimizationSummary;
  /** ISO-8601 timestamp of when the analysis ran */
  analyzedAt: string;
}

// ─── Options for the optimizer ────────────────────────────────────────────────
export interface OptimizerOptions {
  /** Only return recommendations for these categories (default: all) */
  categories?: OptimizationCategory[];
  /** Minimum severity to include (default: 'info') */
  minSeverity?: OptimizationSeverity;
  /** Enable cost-related rules (default: true) */
  enableCostRules?: boolean;
  /** Enable security-related rules (default: true) */
  enableSecurityRules?: boolean;
  /** Enable reliability-related rules (default: true) */
  enableReliabilityRules?: boolean;
}
