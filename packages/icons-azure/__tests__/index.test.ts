import { describe, it, expect } from 'vitest';
import { AZURE_ICON_PACKAGE_NAME } from '../src/index';

describe('@mindfiredigital/adac-icons-azure', () => {
  describe('Package Exports', () => {
    it('should export AZURE_ICON_PACKAGE_NAME', () => {
      expect(AZURE_ICON_PACKAGE_NAME).toBeDefined();
    });

    it('should have the correct package name value', () => {
      expect(AZURE_ICON_PACKAGE_NAME).toBe('@mindfiredigital/adac-icons-azure');
    });

    it('should export AZURE_ICON_PACKAGE_NAME as a string', () => {
      expect(typeof AZURE_ICON_PACKAGE_NAME).toBe('string');
    });

    it('should not be an empty string', () => {
      expect(AZURE_ICON_PACKAGE_NAME.length).toBeGreaterThan(0);
    });

    it('should contain the @mindfiredigital scope', () => {
      expect(AZURE_ICON_PACKAGE_NAME).toMatch(/^@mindfiredigital\//);
    });

    it('should contain "azure" in the package name', () => {
      expect(AZURE_ICON_PACKAGE_NAME).toContain('azure');
    });
  });
});
