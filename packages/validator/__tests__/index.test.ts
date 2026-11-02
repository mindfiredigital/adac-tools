import { describe, expect, it } from 'vitest';
import { validateAdacConfig } from '../src/index';

describe('Adac Validator', () => {
  const validConfig = {
    version: '0.1',
    metadata: {
      name: 'Test Architecture',
      created: '2023-10-27',
    },
    applications: [
      {
        id: 'app1',
        name: 'Test App',
        type: 'frontend',
      },
    ],
    infrastructure: {
      clouds: [
        {
          id: 'aws-1',
          provider: 'aws',
          region: 'us-east-1',
          services: [
            {
              id: 's3-bucket',
              service: 's3',
              name: 'my-bucket',
            },
          ],
        },
      ],
    },
  };

  const invalidConfig = {
    applications: [
      {
        id: 'app1',
      },
    ],
    infrastructure: {
      clouds: [],
    },
  };

  it('should validate valid ADAC config', () => {
    expect(validateAdacConfig(validConfig)).toEqual({ valid: true });
  });

  it('should return validation errors for invalid ADAC config', () => {
    const result = validateAdacConfig(invalidConfig);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('should handle malformed containers without throwing', () => {
    const malformedConfig1 = {
      applications: 'not-an-array',
    };
    const result1 = validateAdacConfig(malformedConfig1);
    expect(result1.valid).toBe(false);

    const malformedConfig2 = {
      infrastructure: {
        clouds: [
          {
            services: 'not-an-array',
          },
        ],
      },
    };
    const result2 = validateAdacConfig(malformedConfig2);
    expect(result2.valid).toBe(false);
  });

  it('should report duplicate IDs across the config', () => {
    const result = validateAdacConfig({
      ...validConfig,
      infrastructure: {
        clouds: [
          {
            id: 'aws-1',
            provider: 'aws',
            region: 'us-east-1',
            services: [
              {
                id: 'app1',
                service: 's3',
                name: 'my-bucket',
              },
            ],
          },
        ],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '/infrastructure/clouds/0/services/0 ID "app1" is not unique'
    );
  });

  it('should treat domain-specific properties as opaque extension data', () => {
    const result = validateAdacConfig({
      ...validConfig,
      cost: {
        total_monthly: -42,
      },
    });

    expect(result).toEqual({ valid: true });
  });

  it('should support explicit validation extensions', () => {
    const result = validateAdacConfig(
      {
        ...validConfig,
        example: {
          enabled: true,
        },
      },
      {
        extensions: [
          {
            name: 'example',
            rootProperties: {
              example: {
                type: 'object',
                properties: {
                  enabled: {
                    type: 'boolean',
                  },
                },
              },
            },
          },
        ],
      }
    );

    expect(result).toEqual({ valid: true });
  });

  it('should reject extensions that redefine core properties', () => {
    expect(() =>
      validateAdacConfig(validConfig, {
        extensions: [
          {
            name: 'override-version',
            rootProperties: {
              version: { type: 'string' },
            },
          },
        ],
      })
    ).toThrow('Extension cannot override core ADAC schema property: version');

    expect(() =>
      validateAdacConfig(validConfig, {
        extensions: [
          {
            name: 'override-id',
            awsServiceProperties: {
              id: { type: 'string' },
            },
          },
        ],
      })
    ).toThrow('Extension cannot override core ADAC schema property: id');

    expect(() =>
      validateAdacConfig(validConfig, {
        extensions: [
          {
            name: 'override-service',
            gcpServiceProperties: {
              service: { type: 'string' },
            },
          },
        ],
      })
    ).toThrow('Extension cannot override core ADAC schema property: service');
  });
});
