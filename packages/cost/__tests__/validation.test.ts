import { describe, expect, it } from 'vitest';
import { validateAdacCostConfig } from '../src';

describe('cost validation wrapper', () => {
  const validConfig = {
    version: '0.1',
    metadata: {
      name: 'Costed Architecture',
      created: '2023-10-27',
    },
    infrastructure: {
      clouds: [
        {
          id: 'aws-1',
          provider: 'aws',
          region: 'us-east-1',
          services: [
            {
              id: 'api',
              service: 'ec2',
              cost: {
                monthly_estimate: 12.5,
                period: 'monthly',
                currency: 'USD',
                pricing_model: 'on-demand',
              },
            },
          ],
        },
      ],
    },
    cost: {
      total_monthly: 12.5,
      period: 'monthly',
      currency: 'USD',
      by_service: {
        ec2: 12.5,
      },
    },
  };

  it('should validate ADAC config with cost fields', () => {
    expect(validateAdacCostConfig(validConfig)).toEqual({ valid: true });
  });

  it('should validate top-level cost summary errors', () => {
    const result = validateAdacCostConfig({
      ...validConfig,
      cost: {
        total_monthly: -5,
        currency: 'DOGE',
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('/cost/total_monthly must be >= 0');
    expect(result.errors).toContain(
      '/cost/currency must be equal to one of the allowed values'
    );
  });

  it('should validate empty architecture with cost summary', () => {
    const result = validateAdacCostConfig({
      version: '0.1',
      metadata: { name: 'Empty', created: '2023-10-27' },
      infrastructure: {
        clouds: [
          {
            id: 'c1',
            provider: 'aws',
            region: 'us-east-1',
          },
        ],
      },
      cost: { total_monthly: 0, currency: 'USD', period: 'monthly' },
    });
    expect(result.valid).toBe(true);
  });

  it('should return cost validation errors for invalid cost values', () => {
    const result = validateAdacCostConfig({
      ...validConfig,
      infrastructure: {
        clouds: [
          {
            id: 'aws-1',
            provider: 'aws',
            region: 'us-east-1',
            services: [
              {
                id: 'api',
                service: 'ec2',
                cost: {
                  monthly_estimate: -1,
                  currency: 'DOGE',
                },
              },
            ],
          },
        ],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '/infrastructure/clouds/0/services/0/cost/monthly_estimate must be >= 0'
    );
    expect(result.errors).toContain(
      '/infrastructure/clouds/0/services/0/cost/currency must be equal to one of the allowed values'
    );
  });
});
