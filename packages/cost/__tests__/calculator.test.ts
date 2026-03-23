import { describe, it, expect } from 'vitest';
import { CostCalculator } from '../src/calculator';
import type { AdacConfig } from '@mindfiredigital/adac-schema';

const makeConfig = (overrides?: Partial<AdacConfig>): AdacConfig =>
  ({
    version: '0.1',
    metadata: { name: 'Test', description: '' },
    applications: [],
    infrastructure: {
      clouds: [
        {
          id: 'aws-test',
          provider: 'aws',
          region: 'us-east-1',
          services: [
            {
              id: 'svc-s3',
              service: 's3',
              name: 'My S3 Bucket',
              description: 'Test S3',
              configuration: {},
            },
            {
              id: 'svc-ec2',
              service: 'ec2',
              name: 'Web Server',
              description: 'Test EC2',
              configuration: { instance_type: 't3.medium' },
            },
          ],
        },
      ],
    },
    connections: [],
    ...overrides,
  }) as unknown as AdacConfig;

describe('CostCalculator', () => {
  const calc = new CostCalculator();

  it('should produce a CostBreakdown with correct structure', () => {
    const result = calc.calculate(makeConfig());
    expect(result).toHaveProperty('totalMonthly');
    expect(result).toHaveProperty('totalYearly');
    expect(result).toHaveProperty('currency', 'USD');
    expect(result).toHaveProperty('byService');
    expect(result).toHaveProperty('byCategory');
    expect(result).toHaveProperty('serviceCount', 2);
  });

  it('should calculate known AWS service costs using catalog', () => {
    const result = calc.calculate(makeConfig());
    // S3 default monthly is 23.0
    expect(result.byService['svc-s3'].monthlyEstimate).toBe(23.0);
    // EC2 default monthly is 30.37
    expect(result.byService['svc-ec2'].monthlyEstimate).toBe(30.37);
    // Total should be the sum
    expect(result.totalMonthly).toBeCloseTo(53.37, 2);
    expect(result.totalYearly).toBeCloseTo(53.37 * 12, 2);
  });

  it('should categorize services correctly', () => {
    const result = calc.calculate(makeConfig());
    expect(result.byService['svc-s3'].category).toBe('storage');
    expect(result.byService['svc-ec2'].category).toBe('compute');
    expect(result.byCategory['storage']).toBe(23.0);
    expect(result.byCategory['compute']).toBe(30.37);
  });

  it('should honour user-supplied cost.monthly_estimate', () => {
    const config = makeConfig();
    // Override the first service with a user-supplied estimate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (config.infrastructure as any).clouds[0].services[0].cost = {
      monthly_estimate: 99.99,
    };
    const result = calc.calculate(config);
    expect(result.byService['svc-s3'].monthlyEstimate).toBe(99.99);
  });

  it('should handle GCP services', () => {
    const config = {
      ...makeConfig(),
      infrastructure: {
        clouds: [
          {
            id: 'gcp-test',
            provider: 'gcp',
            region: 'us-central1',
            services: [
              {
                id: 'svc-gke',
                service: 'gke',
                name: 'GKE Cluster',
                description: 'Test GKE',
                configuration: {},
              },
              {
                id: 'svc-bq',
                service: 'bigquery',
                name: 'BigQuery',
                description: 'Test BQ',
                configuration: {},
              },
            ],
          },
        ],
      },
    } as unknown as AdacConfig;

    const result = calc.calculate(config);
    expect(result.byService['svc-gke'].monthlyEstimate).toBe(72.0);
    expect(result.byService['svc-bq'].monthlyEstimate).toBe(6.25);
    expect(result.byService['svc-gke'].category).toBe('compute');
    expect(result.byService['svc-bq'].category).toBe('analytics');
  });

  it('should handle unknown service types gracefully', () => {
    const config = {
      ...makeConfig(),
      infrastructure: {
        clouds: [
          {
            id: 'aws-test',
            provider: 'aws',
            region: 'us-east-1',
            services: [
              {
                id: 'svc-custom',
                service: 'my-custom-service',
                name: 'Custom Service',
                description: 'Not in catalog',
                configuration: {},
              },
            ],
          },
        ],
      },
    } as unknown as AdacConfig;

    const result = calc.calculate(config);
    expect(result.byService['svc-custom'].monthlyEstimate).toBe(0);
    expect(result.byService['svc-custom'].category).toBe('other');
  });

  it('should handle config with no services', () => {
    const config = {
      ...makeConfig(),
      infrastructure: {
        clouds: [
          { id: 'empty', provider: 'aws', region: 'us-east-1', services: [] },
        ],
      },
    } as unknown as AdacConfig;

    const result = calc.calculate(config);
    expect(result.totalMonthly).toBe(0);
    expect(result.serviceCount).toBe(0);
  });
});
