import { describe, it, expect } from 'vitest';
import {
  getAllTemplates,
  getTemplateById,
  getTemplateConfig,
  templates,
} from '../src/index.js';

describe('@mindfiredigital/adac-templates', () => {
  it('should export all templates via getAllTemplates', () => {
    const all = getAllTemplates();
    expect(all).toBeDefined();
    expect(all.length).toBeGreaterThan(0);
    expect(all).toEqual(templates);
  });

  it('should get a template by its ID', () => {
    const template = getTemplateById('aws-3-tier-web');
    expect(template).toBeDefined();
    expect(template?.id).toBe('aws-3-tier-web');
    expect(template?.name).toContain('3-Tier');
    expect(template?.config.infrastructure.clouds?.[0].provider).toBe('aws');
  });

  it('should return undefined for a non-existent template ID', () => {
    const template = getTemplateById('non-existent-id');
    expect(template).toBeUndefined();
  });

  it('should return just the config for a valid ID', () => {
    const config = getTemplateConfig('aws-serverless-api');
    expect(config).toBeDefined();
    expect(config?.metadata.name).toBe('AWS Serverless API');
  });

  it('should return undefined config for an invalid ID', () => {
    const config = getTemplateConfig('does-not-exist');
    expect(config).toBeUndefined();
  });

  it('should have valid template configurations', () => {
    const all = getAllTemplates();
    for (const t of all) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.config).toBeDefined();
      expect(t.config.version).toBe('0.1');
      expect(t.config.infrastructure).toBeDefined();
      expect(t.config.infrastructure.clouds).toBeDefined();
    }
  });
});
