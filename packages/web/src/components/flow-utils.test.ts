/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { getServiceType, generateYaml } from './flow';

describe('flow-utils', () => {
  describe('getServiceType', () => {
    it('should map AWS services correctly', () => {
      expect(getServiceType('S3 Bucket', '/aws/s3.png', 'aws')).toBe('s3');
      expect(getServiceType('Lambda Function', '', 'aws')).toBe('lambda');
      expect(getServiceType('', 'ec2.png', 'aws')).toBe('ec2');
      expect(getServiceType('Unknown', '', 'aws')).toBe('ec2'); // default
    });

    it('should map GCP services correctly', () => {
      expect(getServiceType('Compute Engine', '', 'gcp')).toBe(
        'compute-engine'
      );
      expect(getServiceType('Cloud Run', '', 'gcp')).toBe('cloud-run');
      expect(getServiceType('GKE', '', 'gcp')).toBe('gke');
      expect(getServiceType('Unknown', '', 'gcp')).toBe('compute-engine'); // default
    });
  });

  describe('generateYaml', () => {
    it('should generate valid YAML from nodes and edges', () => {
      const nodes = [
        {
          id: 'n1',
          data: { label: 'My S3', icon: '/assets/s3.png' },
          position: { x: 0, y: 0 },
        },
      ];
      const edges = [{ id: 'e1', source: 'n1', target: 'n2' }];

      const yaml = generateYaml(nodes as any, edges as any, 'aws');
      expect(yaml).toContain("version: '0.1'");
      expect(yaml).toContain('id: n1');
      expect(yaml).toContain('service: s3');
    });

    it('should include cost and compliance information', () => {
      const nodes = [
        {
          id: 'n1',
          data: {
            label: 'EC2',
            costConfig: { tier: 'on-demand', monthlyCost: 40 },
            complianceFrameworks: ['HIPAA'],
          },
          position: { x: 0, y: 0 },
        },
      ];

      const yaml = generateYaml(nodes as any, [], 'aws');
      expect(yaml).toContain('monthly_estimate: 40');
      expect(yaml).toContain('compliance:');
      expect(yaml).toContain('- HIPAA');
      expect(yaml).toContain('total_monthly_estimate: 40');
    });
  });
});
