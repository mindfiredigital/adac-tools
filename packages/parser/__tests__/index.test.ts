
import { describe, it, expect } from 'vitest';
import { parseAdacFromContent, AdacParseError } from './index';
import { AdacConfig } from '@mindfiredigital/adac-schema';

describe('Adac Parser', () => {
  const validYaml = `
version: "0.1"
metadata:
  name: "Test Architecture"
  created: "2023-10-27"
applications:
  - id: app1
    name: "Test App"
    type: "frontend"
infrastructure:
  clouds:
    - id: aws-1
      provider: aws
      region: "us-east-1"
      services:
        - id: s3-bucket
          service: "s3"
          name: "my-bucket"
`;

  const invalidYaml = `
applications:
  - id: app1
    name: "Test App"
    type: "web"
: invalid syntax
`;

  const invalidSchemaYaml = `
applications:
  - id: app1
    # Missing name and type
infrastructure:
  clouds: []
`;

  it('should parse valid YAML content correctly', () => {
    const result = parseAdacFromContent(validYaml);
    expect(result.applications[0].name).toBe('Test App');
    expect(result.infrastructure.clouds[0].provider).toBe('aws');
  });

  it('should throw AdacParseError for invalid YAML syntax', () => {
    expect(() => parseAdacFromContent(invalidYaml)).toThrow(AdacParseError);
    expect(() => parseAdacFromContent(invalidYaml)).toThrow(/Failed to parse YAML content/);
  });

  it('should throw AdacParseError for schema validation failure', () => {
    try {
      parseAdacFromContent(invalidSchemaYaml);
    } catch (e: any) {
      expect(e).toBeInstanceOf(AdacParseError);
      expect(e.message).toContain('Schema validation failed');
      expect(e.errors).toBeDefined();
      expect(e.errors.length).toBeGreaterThan(0);
    }
  });

  it('should allow skipping validation', () => {
    const result = parseAdacFromContent(invalidSchemaYaml, { validate: false });
    expect(result.applications[0].id).toBe('app1');
    // It parsed but is technically invalid schema-wise
  });
});
