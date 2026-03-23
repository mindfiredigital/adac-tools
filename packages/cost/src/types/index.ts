export type CostCategory =
  | 'compute'
  | 'database'
  | 'storage'
  | 'networking'
  | 'monitoring'
  | 'security'
  | 'messaging'
  | 'analytics'
  | 'other';

export type PricingModel =
  | 'on-demand'
  | 'reserved-1yr'
  | 'reserved-3yr'
  | 'spot'
  | 'savings-plan';

export interface CostLineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface ServiceCost {
  serviceId: string;
  serviceName: string;
  serviceType: string;
  monthlyEstimate: number;
  breakdown: CostLineItem[];
  pricingModel: PricingModel;
  category: CostCategory;
}

export interface CostBreakdown {
  totalMonthly: number;
  totalYearly: number;
  currency: string;
  byService: Record<string, ServiceCost>;
  byCategory: Record<CostCategory, number>;
  serviceCount: number;
}

export interface OptimizationSuggestion {
  serviceId: string;
  currentCost: number;
  potentialCost: number;
  savings: number;
  savingsPercent: number;
  suggestion: string;
  action: string;
  risk: 'low' | 'medium' | 'high';
}
