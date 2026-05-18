import { describe, it, expect } from 'vitest';
import { getRulesForFramework } from '../../src/frameworks';

describe('HIPAA Framework Rules', () => {
  it('should include encryption, logging, access control and backup rules', () => {
    const rules = getRulesForFramework('hipaa');
    expect(rules.length).toBeGreaterThan(0);

    const ruleIds = rules.map((r) => r.id);
    expect(ruleIds).toContain('enc-01');
    expect(ruleIds).toContain('log-01');
    expect(ruleIds).toContain('iam-01');
    expect(ruleIds).toContain('bck-01');
  });
});
