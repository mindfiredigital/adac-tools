export interface AdacModel {
  infrastructure?: {
    clouds?: {
      services?: Record<string, unknown>[];
    }[];
  };
  connections?: Record<string, unknown>[];
}

/**
 * Analyzes the complexity of an AdacModel to determine if it requires advanced layout.
 * Uses node and edge counts to compute a complexity score.
 * 
 * @param model - The AdacModel to analyze.
 * @returns true if the model layout is complex and requires advanced engines, false otherwise.
 */
export function analyzeComplexity(model?: AdacModel): boolean {
  if (!model) return false;

  let score = 0;

  const nodeCount =
    model.infrastructure?.clouds?.reduce(
      (sum, cloud) => sum + (cloud.services?.length || 0),
      0
    ) || 0;

  if (nodeCount > 200) score += 20;

  const edgeCount = model.connections?.length || 0;
  if (edgeCount > 300) score += 20;

  // We return true if score >= 20, meaning at least one boundary
  // was broken (i.e. more than 200 nodes OR more than 300 edges).
  return score >= 20;
}
