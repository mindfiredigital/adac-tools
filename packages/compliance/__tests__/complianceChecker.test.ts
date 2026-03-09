import { describe, it, expect } from 'vitest';
import { ComplianceChecker } from '../src/complianceChecker';
import compliantArchBase from './fixtures/compliantArch.json';
import nonCompliantArchBase from './fixtures/nonCompliantArch.json';
import { AdacConfig } from '@mindfiredigital/adac-schema';

const compliantArch = compliantArchBase as unknown as AdacConfig;
const nonCompliantArch = nonCompliantArchBase as unknown as AdacConfig;

describe('ComplianceChecker', () => {
  it('should return no violations for compliant architecture', () => {
    const checker = new ComplianceChecker();
    const { byService, results } = checker.checkCompliance(compliantArch);

    // db-1 declares pci-dss and soc2
    expect(Object.keys(byService)).toContain('db-1');
    expect(byService['db-1'].length).toBe(2); // one result per framework

    // Both frameworks should be compliant
    expect(byService['db-1'].every((r) => r.isCompliant)).toBe(true);

    // Flat results convenience array
    expect(results.length).toBe(2);
    expect(results.every((r) => r.violations.length === 0)).toBe(true);
  });

  it('should detect violations in non-compliant architecture', () => {
    const checker = new ComplianceChecker();
    const { byService, results, remediationPlan } =
      checker.checkCompliance(nonCompliantArch);

    // db-unsafe declares pci-dss
    expect(Object.keys(byService)).toContain('db-unsafe');
    expect(byService['db-unsafe'].length).toBe(1);
    expect(byService['db-unsafe'][0].isCompliant).toBe(false);
    expect(byService['db-unsafe'][0].violations.length).toBeGreaterThan(0);

    // Flat results
    expect(results.length).toBe(1);
    expect(results[0].isCompliant).toBe(false);

    // Remediation plan should have actionable steps
    expect(remediationPlan.length).toBeGreaterThan(0);
  });

  it('should skip services with no compliance field', () => {
    const noComplianceArch: AdacConfig = {
      version: '0.1',
      metadata: { name: 'No Compliance Arch', created: '2026-02-26' },
      infrastructure: {
        clouds: [
          {
            id: 'cloud-1',
            provider: 'aws',
            region: 'us-east-1',
            services: [
              {
                id: 'my-s3',
                service: 's3',
                name: 'Plain Bucket',
                // no compliance field
              },
            ],
          },
        ],
      },
    };

    const checker = new ComplianceChecker();
    const { byService, results } = checker.checkCompliance(noComplianceArch);

    expect(Object.keys(byService).length).toBe(0);
    expect(results.length).toBe(0);
  });
});
