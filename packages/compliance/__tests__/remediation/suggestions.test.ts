import { describe, it, expect } from 'vitest';
import { commonSuggestions } from '../../src/remediation/suggestions';

describe('commonSuggestions', () => {
  it('should export an object with all expected suggestion keys', () => {
    expect(commonSuggestions).toBeDefined();
    expect(typeof commonSuggestions).toBe('object');
    expect(commonSuggestions).toHaveProperty('enableEncryption');
    expect(commonSuggestions).toHaveProperty('privateSubnet');
    expect(commonSuggestions).toHaveProperty('enableLogging');
    expect(commonSuggestions).toHaveProperty('leastPrivilege');
  });

  it('should have non-empty string values for all suggestions', () => {
    for (const value of Object.values(commonSuggestions)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('enableEncryption suggestion should mention encrypted config key', () => {
    expect(commonSuggestions.enableEncryption).toContain('encrypted');
  });

  it('privateSubnet suggestion should mention private subnet', () => {
    expect(commonSuggestions.privateSubnet.toLowerCase()).toContain('private subnet');
  });

  it('enableLogging suggestion should mention access logs', () => {
    expect(commonSuggestions.enableLogging.toLowerCase()).toContain('log');
  });

  it('leastPrivilege suggestion should mention wildcard or IAM policies', () => {
    const suggestion = commonSuggestions.leastPrivilege.toLowerCase();
    expect(suggestion.includes('wildcard') || suggestion.includes('iam')).toBe(true);
  });
});