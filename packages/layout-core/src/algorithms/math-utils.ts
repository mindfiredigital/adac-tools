export function computeMedian(values: number[]): number {
  if (values.length === 0) {
    throw new Error('computeMedian requires at least one value.');
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
