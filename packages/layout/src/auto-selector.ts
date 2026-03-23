// Placeholder complexity analysis
// For now: always return false (use custom)

export interface AdacModel {
  infrastructure?: {
    clouds?: {
      services?: any[];
    }[];
  };
  connections?: any[];
}

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

  return score > 30;
}