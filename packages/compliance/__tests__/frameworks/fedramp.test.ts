import { describe, it, expect } from 'vitest';
import { getRulesForFramework } from '../../src/frameworks';
import { fedrampRules } from '../../src/frameworks/fedramp';

describe('FedRAMP Framework Rules', () => {
  it('should include access control and logging rules', () => {
    const rules = getRulesForFramework('fedramp');
    expect(rules.length).toBeGreaterThan(0);

    const ruleIds = rules.map((r) => r.id);
    expect(ruleIds).toContain('iam-01');
    expect(ruleIds).toContain('log-01');
  });

  it('should not include network rules (fedramp does not use net-01)', () => {
    const rules = getRulesForFramework('fedramp');
    const ruleIds = rules.map((r) => r.id);
    expect(ruleIds).not.toContain('net-01');
  });

  it('fedrampRules export should match getRulesForFramework result', () => {
    const ruleIds = fedrampRules.map((r) => r.id);
    const expectedIds = getRulesForFramework('fedramp').map((r) => r.id);
    expect(ruleIds).toEqual(expectedIds);
  });

  it('all fedramp rules should have fedramp in their frameworks array', () => {
    const rules = getRulesForFramework('fedramp');
    for (const rule of rules) {
      expect(rule.frameworks).toContain('fedramp');
    }
  });

  it('fedramp rules should have required properties', () => {
    const rules = getRulesForFramework('fedramp');
    for (const rule of rules) {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(['low', 'medium', 'high', 'critical']).toContain(rule.severity);
      expect(typeof rule.evaluate).toBe('function');
    }
  });
});