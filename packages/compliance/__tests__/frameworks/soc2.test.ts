import { describe, it, expect } from 'vitest';
import { getRulesForFramework } from '../../src/frameworks';

describe('SOC2 Framework Rules', () => {
  it('should include necessary rules for soc2', () => {
    const rules = getRulesForFramework('soc2');
    expect(rules.length).toBeGreaterThan(0);

    const ruleIds = rules.map((r) => r.id);
    expect(ruleIds).toContain('enc-01');
    expect(ruleIds).toContain('net-01');
    expect(ruleIds).toContain('mon-01');
    expect(ruleIds).toContain('log-01');
  });
});
