import { describe, it, expect } from 'vitest';
import { validateAdacConfig } from '../src/validator.js';

describe('Adac Schema Validator', () => {
  it('should validate a correct configuration', () => {
    const validConfig = {
      version: '0.1',
      metadata: {
        name: 'Test Architecture',
        created: '2023-10-27',
      },
      infrastructure: {
        clouds: [
          {
            id: 'aws-main',
            provider: 'aws',
            region: 'us-east-1',
            services: [
              {
                id: 'web-server',
                service: 'ec2',
                name: 'Web Server',
                configuration: {
                  instance_type: 't3.micro',
                },
              },
            ],
          },
        ],
      },
    };
    const result = validateAdacConfig(validConfig);
    expect(result.valid).toBe(true);
  });

  it('should fail validation when required fields are missing', () => {
    const invalidConfig = {
      version: '0.1',
      metadata: {
        name: 'Invalid',
        // Missing 'created'
      },
      infrastructure: {
        clouds: [], // Empty clouds array (minItems: 1)
      },
    };
    const result = validateAdacConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
    // AJV errors format might vary slightly, but we expect errors about 'created' and 'clouds'
    const errorStrings = result.errors!.join(' ');
    expect(errorStrings).toContain('metadata');
    expect(errorStrings).toContain('infrastructure/clouds');
  });

  it('should fail validation for invalid service configuration', () => {
    const invalidServiceConfig = {
      version: '0.1',
      metadata: {
        name: 'Test Architecture',
        created: '2023-10-27',
      },
      infrastructure: {
        clouds: [
          {
            id: 'aws-main',
            provider: 'aws',
            region: 'us-east-1',
            services: [
              {
                id: 'web-server',
                service: 'ec2',
                name: 'Web Server',
                configuration: {
                  instance_type: 123, // Should be string
                },
              },
            ],
          },
        ],
      },
    };
    const result = validateAdacConfig(invalidServiceConfig);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes('instance_type'))).toBe(true);
  });

  it('should fail validation for invalid region', () => {
    const invalidRegionConfig = {
      version: '0.1',
      metadata: {
        name: 'Test Architecture',
        created: '2023-10-27',
      },
      infrastructure: {
        clouds: [
          {
            id: 'aws-main',
            provider: 'aws',
            region: 'invalid-region', // Invalid region
            services: [],
          },
        ],
      },
    };
    const result = validateAdacConfig(invalidRegionConfig);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes('region'))).toBe(true);
  });

  it('should fail validation for invalid connection type', () => {
    const invalidConnectionConfig = {
      version: '0.1',
      metadata: {
        name: 'Test Architecture',
        created: '2023-10-27',
      },
      infrastructure: {
        clouds: [
          {
            id: 'aws-main',
            provider: 'aws',
            region: 'us-east-1',
            services: [],
          },
        ],
      },
      connections: [
        {
          id: 'conn-1',
          from: 'a',
          to: 'b',
          type: 'invalid-type',
        },
      ],
    };
    const result = validateAdacConfig(invalidConnectionConfig);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes('type'))).toBe(true);
  });
});
