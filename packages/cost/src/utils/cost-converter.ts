import type { CostPeriod } from '../types';

/**
 * Convert an hourly cost into requested period.
 */
export function convertCost(
  hourlyCost: number,
  period: CostPeriod = 'monthly'
): number {
  switch (period) {
    case 'hourly':
      return hourlyCost;
    case 'daily':
      return hourlyCost * 24;
    case 'monthly':
      return hourlyCost * 730;
    case 'yearly':
      return hourlyCost * 730 * 12;
    default:
      return hourlyCost * 730;
  }
}

/**
 * Convert a monthly cost into requested period.
 * Useful for request/storage/GB-style monthly usage inputs.
 */
export function convertMonthlyCost(
  monthlyCost: number,
  period: CostPeriod = 'monthly'
): number {
  switch (period) {
    case 'hourly':
      return monthlyCost / 730;
    case 'daily':
      return monthlyCost / 30.4167;
    case 'monthly':
      return monthlyCost;
    case 'yearly':
      return monthlyCost * 12;
    default:
      return monthlyCost;
  }
}
