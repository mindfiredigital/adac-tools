import { describe, it, expect } from 'vitest';
import * as Module from '../src/index';

describe('index.ts', () => {
  it('should re-export generateDiagram from `@mindfiredigital/adac-core`', async () => {
    expect(Module).toBeDefined();
    expect(Module).toHaveProperty('generateDiagram');
    expect(typeof Module.generateDiagram).toBe('function');
  });

  it('should generate diagrams with compliance tooltips from the diagram package', async () => {
    const yaml = `
version: "0.1"
metadata:
  name: "Compliance Arch"
  created: "2023-11-01"
infrastructure:
  clouds:
    - id: "aws-1"
      provider: "aws"
      region: "us-east-1"
      services:
        - id: "vm-1"
          service: "ec2"
          name: "Server"
          compliance:
            - soc2
          configuration:
            instance_type: "t3.micro"
`;

    const result = await Module.generateDiagramSvg(yaml, 'custom');

    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('soc2');
  });

  it('should generate diagrams when cost-aware validation passes', async () => {
    const yaml = `
version: "0.1"
metadata:
  name: "Costed Arch"
  created: "2023-11-01"
infrastructure:
  clouds:
    - id: "aws-1"
      provider: "aws"
      region: "us-east-1"
      services:
        - id: "vm-1"
          service: "ec2"
          name: "Server"
          cost:
            monthly_estimate: 12
            currency: USD
`;

    const result = await Module.generateDiagramSvg(
      yaml,
      'custom',
      false,
      undefined,
      'monthly',
      false,
      true
    );

    expect(result.svg).toContain('<svg');
  });

  it('should reject diagrams when cost-aware validation fails', async () => {
    const yaml = `
version: "0.1"
metadata:
  name: "Invalid Cost Arch"
  created: "2023-11-01"
infrastructure:
  clouds:
    - id: "aws-1"
      provider: "aws"
      region: "us-east-1"
      services:
        - id: "vm-1"
          service: "ec2"
          name: "Server"
          cost:
            monthly_estimate: -12
`;

    await expect(
      Module.generateDiagramSvg(
        yaml,
        'custom',
        false,
        undefined,
        'monthly',
        false,
        true
      )
    ).rejects.toThrow('Cost validation failed');
  });

  it('should generate diagrams and handle fully compliant services correctly', async () => {
    const yaml = `
version: "0.1"
metadata:
  name: "Compliant Arch"
  created: "2023-11-01"
infrastructure:
  clouds:
    - id: "aws-1"
      provider: "aws"
      region: "us-east-1"
      services:
        - id: "db-1"
          service: "rds"
          name: "My Secure DB"
          compliance:
            - pci-dss
          config:
            encrypted: true
            publiclyAccessible: false
            backupRetentionPeriod: 7
          monitoring:
            enabled: true
`;

    const result = await Module.generateDiagramSvg(yaml, 'custom');

    // Check that SVG is generated correctly and compliance tooltips aren't added as violations
    expect(result.svg).toContain('<svg');
    expect(result.svg).not.toContain('violation');
  });
});
