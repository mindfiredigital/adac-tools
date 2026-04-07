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

  const COMPLEX_NODE_THRESHOLD = 200;
  const COMPLEX_EDGE_THRESHOLD = 300;

  const nodeCount =
    model.infrastructure?.clouds?.reduce(
      (sum, cloud) => sum + (cloud.services?.length || 0),
      0
    ) || 0;

  const edgeCount = model.connections?.length || 0;

  // We return true if either the node count or the edge count
  // exceeds the established threshold, making the layout complex.
  return nodeCount > COMPLEX_NODE_THRESHOLD || edgeCount > COMPLEX_EDGE_THRESHOLD;
}
