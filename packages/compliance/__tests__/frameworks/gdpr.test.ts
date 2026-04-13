import { describe, it, expect } from 'vitest';
import { getRulesForFramework } from '../../src/frameworks';
import { gdprRules } from '../../src/frameworks/gdpr';

describe('GDPR Framework Rules', () => {
  it('should include encryption rule', () => {
    const rules = getRulesForFramework('gdpr');
    expect(rules.length).toBeGreaterThan(0);

    const ruleIds = rules.map((r) => r.id);
    expect(ruleIds).toContain('enc-01');
  });

  it('gdprRules export should match getRulesForFramework result', () => {
    const ruleIds = gdprRules.map((r) => r.id);
    const expectedIds = getRulesForFramework('gdpr').map((r) => r.id);
    expect(ruleIds).toEqual(expectedIds);
  });

  it('all gdpr rules should have gdpr in their frameworks array', () => {
    const rules = getRulesForFramework('gdpr');
    for (const rule of rules) {
      expect(rule.frameworks).toContain('gdpr');
    }
  });

  it('gdpr rules should have required properties', () => {
    const rules = getRulesForFramework('gdpr');
    for (const rule of rules) {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(['low', 'medium', 'high', 'critical']).toContain(rule.severity);
      expect(typeof rule.evaluate).toBe('function');
    }
  });

  it('should not include monitoring rule (gdpr does not use mon-01)', () => {
    const rules = getRulesForFramework('gdpr');
    const ruleIds = rules.map((r) => r.id);
    expect(ruleIds).not.toContain('mon-01');
  });

  it('should return empty array for unknown framework', () => {
    const rules = getRulesForFramework('invalid-framework');
    expect(rules).toEqual([]);
    expect(rules).toHaveLength(0);
  });
});