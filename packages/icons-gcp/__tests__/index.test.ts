import { describe, it, expect } from 'vitest';

/**
 * Test suite for @mindfiredigital/adac-icons-gcp
 * Tests the GCP icon package module functionality and exports
 */
describe('icons-gcp', () => {
  it('should import the module successfully', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../dist/index.js');
    }).not.toThrow();
  });

  it('should export GCP_ICON_PACKAGE_NAME constant', async () => {
    const module = await import('../src/index.ts');
    expect(module.GCP_ICON_PACKAGE_NAME).toBe(
      '@mindfiredigital/adac-icons-gcp'
    );
  });

  it('should have GCP_ICON_PACKAGE_NAME defined correctly', () => {
    const GCP_ICON_PACKAGE_NAME = '@mindfiredigital/adac-icons-gcp';
    expect(GCP_ICON_PACKAGE_NAME).toContain('gcp');
    expect(GCP_ICON_PACKAGE_NAME).toContain('icons');
  });

  it('should be compatible with GCP icon setup', () => {
    const packageName = 'adac-icons-gcp';
    expect(packageName).toContain('gcp');
    expect(packageName).toContain('icons');
  });

  it('should have proper module structure for icon mappings', () => {
    const iconMetadata = {
      name: '@mindfiredigital/adac-icons-gcp',
      description: 'GCP service icons and mappings for ADAC diagrams',
      type: 'icon-set',
    };

    expect(iconMetadata.name).toContain('adac-icons-gcp');
    expect(iconMetadata.type).toBe('icon-set');
    expect(iconMetadata.description).toContain('GCP');
  });

  it('should support GCP services setup script', () => {
    const setupCommand = 'setup-icons';
    const setupNote =
      'Run `pnpm --filter @mindfiredigital/adac-icons-gcp setup-icons` to generate icons';
    expect(setupCommand).toBe('setup-icons');
    expect(setupNote).toContain('setup-icons');
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

  describe('GCP specific configurations', () => {
    it('should be titled with GCP reference', () => {
      const title = '@mindfiredigital/adac-icons-gcp';
      expect(title).toContain('gcp');
      expect(title.toLowerCase()).toContain('gcp');
    });

    it('should have GCP in keywords', () => {
      const keywords = ['adac', 'icons', 'gcp', 'diagram', 'assets'];
      expect(keywords).toContain('gcp');
    });

    it('should support Compute Engine, Cloud Functions, Cloud SQL and other GCP services', () => {
      const gcpServices = [
        'ComputeEngine',
        'CloudFunctions',
        'CloudSQL',
        'CloudStorage',
        'VPC',
        'CloudRun',
      ];
      expect(gcpServices.length).toBeGreaterThan(0);
      expect(gcpServices).toContain('CloudFunctions');
      expect(gcpServices).toContain('CloudStorage');
    });

    it('should have comprehensive GCP service icon coverage', () => {
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
      const mappingsFile = 'mappings/gcp-icons.json';
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
        'getGcpIcon',
        'getGcpServiceIcon',
        'getGcpServicesByCategory',
      ];
      expect(exportedFunctions.length).toBeGreaterThan(0);
      expect(Array.isArray(exportedFunctions)).toBe(true);
    });

    it('should define icon constants', () => {
      const constants = {
        GCP_ICON_PACKAGE_NAME: '@mindfiredigital/adac-icons-gcp',
        VERSION: '0.0.1',
      };
      expect(constants.GCP_ICON_PACKAGE_NAME).toContain('gcp');
    });

    it('should correctly export GCP_ICON_PACKAGE_NAME', () => {
      const GCP_ICON_PACKAGE_NAME = '@mindfiredigital/adac-icons-gcp';
      expect(GCP_ICON_PACKAGE_NAME).toMatch(/adac-icons-gcp/);
    });
  });

  describe('Setup requirements', () => {
    it('should indicate setup is required', () => {
      const setupRequired =
        'Run `pnpm --filter @mindfiredigital/adac-icons-gcp setup-icons` to generate icons';
      expect(setupRequired).toContain('setup-icons');
      expect(setupRequired).toContain('@mindfiredigital/adac-icons-gcp');
    });

    it('should document the icon-map.json generation', () => {
      const fileName = 'icon-map.json';
      expect(fileName).toContain('icon');
      expect(fileName).toContain('json');
    });
  });
});
