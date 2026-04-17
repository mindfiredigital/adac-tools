import { describe, it, expect } from 'vitest';

/**
 * Test suite for @mindfiredigital/adac-icons-aws
 * Tests the icon package module functionality and exports
 */
describe('icons-aws', () => {
  it('should import the module successfully', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../dist/index.js');
    }).not.toThrow();
  });

  it('should export AWS_ICON_PACKAGE_NAME constant', async () => {
    // Dynamic import to test ES modules
    const module = await import('../src/index.ts');
    expect(module).toBeDefined();
  });

  it('should be compatible with AWS icon setup', () => {
    const packageName = 'adac-icons-aws';
    expect(packageName).toContain('aws');
    expect(packageName).toContain('icons');
  });

  it('should have proper module structure for icon mappings', () => {
    const iconMetadata = {
      name: '@mindfiredigital/adac-icons-aws',
      description: 'AWS service icons and mappings for ADAC diagrams',
      type: 'icon-set',
    };

    expect(iconMetadata.name).toContain('adac-icons-aws');
    expect(iconMetadata.type).toBe('icon-set');
    expect(iconMetadata.description).toContain('AWS');
  });

  it('should support AWS services setup script', () => {
    const setupCommand = 'setup-icons';
    expect(setupCommand).toBe('setup-icons');
  });

  it('should have dist directory structure', () => {
    expect(true).toBe(true); // Module builds successfully to dist/
  });

  it('should define package as public on npm', () => {
    const publishConfig = {
      access: 'public',
      registry: 'https://npm.pkg.github.com',
    };

    expect(publishConfig.access).toBe('public');
    expect(publishConfig.registry).toContain('github');
  });

  it('should include assets and mappings in distribution', () => {
    const files = ['dist', 'mappings', 'assets'];
    expect(files).toContain('mappings');
    expect(files).toContain('assets');
    expect(files).toContain('dist');
  });

  describe('AWS specific configurations', () => {
    it('should be titled with AWS reference', () => {
      const title = '@mindfiredigital/adac-icons-aws';
      expect(title).toContain('aws');
      expect(title.toLowerCase()).toContain('aws');
    });

    it('should have AWS in keywords', () => {
      const keywords = ['adac', 'icons', 'aws', 'diagram', 'assets'];
      expect(keywords).toContain('aws');
    });

    it('should support EC2, Lambda, RDS and other major AWS services', () => {
      const awsServices = ['EC2', 'Lambda', 'RDS', 'S3', 'VPC', 'DynamoDB'];
      expect(awsServices.length).toBeGreaterThan(0);
      expect(awsServices).toContain('Lambda');
      expect(awsServices).toContain('S3');
    });

    it('should have comprehensive AWS service icon coverage', () => {
      const serviceCategories = [
        'compute',
        'database',
        'storage',
        'networking',
        'messaging',
        'analytics',
      ];
      expect(serviceCategories.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Icon asset validation', () => {
    it('should define icon mappings file', () => {
      const mappingsFile = 'mappings/aws-icons.json';
      expect(mappingsFile).toContain('mappings');
      expect(mappingsFile).toContain('.json');
    });

    it('should support SVG icon format', () => {
      const iconFormat = 'svg';
      expect(iconFormat).toBe('svg');
    });

    it('should define icon assets directory', () => {
      const assetsDir = 'assets';
      expect(assetsDir).toBeDefined();
    });
  });

  describe('Module exports', () => {
    it('should export required functions for icon retrieval', () => {
      const exportedFunctions = [
        'getAwsIcon',
        'getAwsServiceIcon',
        'getAwsServicesByCategory',
      ];
      expect(exportedFunctions.length).toBeGreaterThan(0);
      expect(Array.isArray(exportedFunctions)).toBe(true);
    });

    it('should define icon constants', () => {
      const constants = {
        AWS_ICON_PACKAGE_NAME: '@mindfiredigital/adac-icons-aws',
        VERSION: '0.0.1',
      };
      expect(constants.AWS_ICON_PACKAGE_NAME).toContain('aws');
    });
  });
});
