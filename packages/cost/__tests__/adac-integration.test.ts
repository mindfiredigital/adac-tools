import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  aggregateCostFromYaml,
  calculatePerServiceCosts,
  mapAdacServicesToCostConfig,
} from '../src';

describe('ADAC cost integration helpers', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('should map ADAC services into calculator cost config groups', () => {
    const result = mapAdacServicesToCostConfig(
      [
        {
          service: 'ec2',
          configuration: {
            instance_type: 't3.medium',
            count: 2,
          },
        },
        {
          service: 'lambda',
          config: {
            requests_per_month: 2_000_000,
            avg_duration_ms: 250,
            memory_mb: 256,
          },
        },
        {
          service: 'rds-postgres',
          configuration: {
            instance_class: 'db.t3.micro',
          },
        },
        {
          service: 'dynamodb',
          configuration: {
            read_units: 5,
            write_units: 2,
            storage_gb: 20,
          },
        },
        {
          service: 's3',
          configuration: {
            storage_gb: 100,
            tier: 'infrequent_access',
          },
        },
        {
          type: 'storage',
          subtype: 'ebs',
          config: {
            size_gb: 50,
            volume_type: 'io1',
            count: 3,
          },
        },
        {
          type: 'network',
          subtype: 'application-load-balancer',
          config: {
            lcu_units: 2,
          },
        },
        {
          type: 'network',
          subtype: 'data-transfer',
          config: {
            transfer_gb: 250,
          },
        },
      ],
      'reserved'
    );

    expect(result.compute).toHaveLength(2);
    expect(result.compute?.[0]).toMatchObject({
      type: 'ec2',
      instanceType: 't3.medium',
      count: 2,
      pricingModel: 'reserved',
    });
    expect(result.database).toHaveLength(2);
    expect(result.storage).toHaveLength(2);
    expect(result.storage?.[0]).toMatchObject({
      type: 's3',
      tier: 'infrequent_access',
      storageGB: 100,
    });
    expect(result.networking).toHaveLength(2);
  });

  it('should return undefined per-service costs when ADAC has no services', () => {
    expect(calculatePerServiceCosts({ infrastructure: { clouds: [] } })).toBe(
      undefined
    );
  });

  it('should calculate costs across multiple regions', () => {
    const result = calculatePerServiceCosts({
      infrastructure: {
        clouds: [
          {
            region: 'us-east-1',
            services: [
              {
                id: 'api-us',
                service: 'ec2',
                configuration: { instance_type: 't3.medium' },
              },
            ],
          },
          {
            region: 'eu-west-1',
            services: [
              {
                id: 'api-eu',
                service: 'ec2',
                configuration: { instance_type: 't3.medium' },
              },
            ],
          },
        ],
      },
    });

    expect(result).toEqual({
      'api-us': expect.any(Number),
      'api-eu': expect.any(Number),
    });
    expect(result?.['api-us']).toBeGreaterThan(0);
    expect(result?.['api-eu']).toBeGreaterThan(0);
  });

  it('should calculate positive costs per service id', () => {
    const result = calculatePerServiceCosts({
      infrastructure: {
        clouds: [
          {
            services: [
              {
                id: 'api',
                service: 'ec2',
                configuration: {
                  instance_type: 't3.medium',
                },
              },
              {
                id: 'ignored',
                service: 'unknown',
              },
              {
                service: 'ec2',
                configuration: {
                  instance_type: 't3.medium',
                },
              },
            ],
          },
        ],
      },
    });

    expect(result).toEqual({
      api: expect.any(Number),
    });
    expect(result?.api).toBeGreaterThan(0);
  });

  it('should aggregate costs from an ADAC YAML file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'adac-cost-'));
    tempDirs.push(dir);
    const yamlPath = join(dir, 'architecture.adac.yaml');

    writeFileSync(
      yamlPath,
      [
        'version: "0.1"',
        'metadata:',
        '  name: Cost Test',
        '  created: 2023-10-27',
        'infrastructure:',
        '  clouds:',
        '    - id: aws-1',
        '      provider: aws',
        '      region: us-east-1',
        '      services:',
        '        - id: api',
        '          service: ec2',
        '          configuration:',
        '            instance_type: t3.medium',
        '            count: 1',
      ].join('\n')
    );

    const result = aggregateCostFromYaml(yamlPath);

    expect(result.total).toBeGreaterThan(0);
    expect(result.compute).toBeGreaterThan(0);
  });
});
