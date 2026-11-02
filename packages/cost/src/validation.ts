import {
  validateAdacConfig,
  type ValidationExtension,
  type ValidationResult,
} from '@mindfiredigital/adac-validator';

const costSchema = {
  type: 'object',
  description: 'Cost information for a service',
  required: ['monthly_estimate'],
  properties: {
    monthly_estimate: {
      type: 'number',
      minimum: 0,
      description: 'Estimated cost for the selected period in USD',
    },
    period: {
      type: 'string',
      enum: ['monthly', 'yearly', 'weekly', 'daily'],
      default: 'monthly',
      description: 'The period for which the cost estimate applies',
    },
    currency: {
      type: 'string',
      enum: ['USD', 'EUR', 'GBP', 'JPY', 'INR'],
      default: 'USD',
      description: 'Currency',
    },
    breakdown: {
      type: 'array',
      description: 'Cost breakdown details',
      items: {
        type: 'string',
      },
    },
    pricing_model: {
      type: 'string',
      enum: [
        'on-demand',
        'reserved-1yr',
        'reserved-3yr',
        'spot',
        'savings-plan',
      ],
      description: 'AWS pricing model',
    },
  },
};

const costSummarySchema = {
  type: 'object',
  description: 'Overall architecture cost summary',
  required: ['total_monthly'],
  properties: {
    total_monthly: {
      type: 'number',
      minimum: 0,
      description: 'Total cost for the selected period',
    },
    period: {
      type: 'string',
      enum: ['monthly', 'yearly', 'weekly', 'daily'],
      default: 'monthly',
      description: 'The period for which the cost summary applies',
    },
    currency: {
      type: 'string',
      enum: ['USD', 'EUR', 'GBP', 'JPY', 'INR'],
      default: 'USD',
    },
    by_service: {
      type: 'object',
      description: 'Cost breakdown by service type',
      additionalProperties: {
        type: 'number',
      },
    },
    by_environment: {
      type: 'object',
      description: 'Cost breakdown by environment',
      additionalProperties: {
        type: 'number',
      },
    },
    notes: {
      type: 'array',
      description: 'Cost calculation notes',
      items: {
        type: 'string',
      },
    },
  },
};

export const costValidationExtension: ValidationExtension = {
  name: 'cost',
  rootProperties: {
    cost: costSummarySchema,
  },
  awsServiceProperties: {
    cost: costSchema,
  },
  gcpServiceProperties: {
    cost: costSchema,
  },
};

export function validateAdacCostConfig(config: unknown): ValidationResult {
  return validateAdacConfig(config, {
    extensions: [costValidationExtension],
  });
}
