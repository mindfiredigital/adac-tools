import type { AdacConfig, AdacCloud } from '@mindfiredigital/adac-schema';

export type AdacModel = Partial<Pick<AdacConfig, 'infrastructure' | 'connections'>>;

/**
 * Analyzes the complexity of an AdacModel to determine if it requires advanced layout.
 * Checks node and edge counts against defined complexity thresholds.
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
      (sum: number, cloud: AdacCloud) => sum + (cloud.services?.length || 0),
      0
    ) || 0;

  const edgeCount = model.connections?.length || 0;

  // We return true if either the node count or the edge count
  // exceeds the established threshold, making the layout complex.
  return nodeCount > COMPLEX_NODE_THRESHOLD || edgeCount > COMPLEX_EDGE_THRESHOLD;
}
