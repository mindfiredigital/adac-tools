import { describe, it, expect } from 'vitest';
import { getRulesForFramework } from '../../src/frameworks';
import { iso27001Rules } from '../../src/frameworks/iso27001';

describe('ISO27001 Framework Rules', () => {
  it('should include access control, backup, network, logging, and monitoring rules', () => {
    const rules = getRulesForFramework('iso27001');
    expect(rules.length).toBeGreaterThan(0);

    const ruleIds = rules.map((r) => r.id);
    expect(ruleIds).toContain('iam-01');
    expect(ruleIds).toContain('bck-01');
    expect(ruleIds).toContain('net-01');
    expect(ruleIds).toContain('log-01');
    expect(ruleIds).toContain('mon-01');
  });

  it('iso27001Rules export should match getRulesForFramework result', () => {
    const ruleIds = iso27001Rules.map((r) => r.id);
    const expectedIds = getRulesForFramework('iso27001').map((r) => r.id);
    expect(ruleIds).toEqual(expectedIds);
  });

  it('all iso27001 rules should have iso27001 in their frameworks array', () => {
    const rules = getRulesForFramework('iso27001');
    for (const rule of rules) {
      expect(rule.frameworks).toContain('iso27001');
    }
  });

  it('iso27001 rules should have required properties', () => {
    const rules = getRulesForFramework('iso27001');
    for (const rule of rules) {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(['low', 'medium', 'high', 'critical']).toContain(rule.severity);
      expect(typeof rule.evaluate).toBe('function');
    }
  });

  it('should not include encryption rule (iso27001 does not use enc-01)', () => {
    const rules = getRulesForFramework('iso27001');
    const ruleIds = rules.map((r) => r.id);
    expect(ruleIds).not.toContain('enc-01');
  });

  it('should return empty array for unknown framework', () => {
    const rules = getRulesForFramework('invalid-framework');
    expect(rules).toEqual([]);
    expect(rules).toHaveLength(0);
  });
});
