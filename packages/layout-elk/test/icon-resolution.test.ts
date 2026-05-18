/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vitest, beforeEach } from 'vitest';
import { buildElkGraph } from '../src/elk-builder.js';
import fs from 'fs';
import path from 'path';

describe('ELK Builder Icon Resolution', () => {
  beforeEach(() => {
    vitest.clearAllMocks();
  });

  it('should cover AWS icon resolution paths', () => {
    // Mock fs.existsSync to satisfy some paths and fail others
    const existSpy = vitest
      .spyOn(fs, 'existsSync')
      .mockImplementation((p: any) => {
        if (p.toString().includes('icon-map.json')) return true;
        if (p.toString().includes('RDS')) return true;
        if (p.toString().includes('ec2')) return true;
        return false;
      });
    const readSpy = vitest
      .spyOn(fs, 'readFileSync')
      .mockImplementation((p: any) => {
        if (p.toString().includes('icon-map.json'))
          return JSON.stringify({
            'AWS::RDS': 'rds.png',
            'Amazon Elastic Compute Cloud (Amazon EC2)': 'ec2.png',
          });
        return '';
      });

    const config: any = {
      version: '0.1',
      infrastructure: {
        clouds: [
          {
            provider: 'aws',
            services: [
              { id: 's1', service: 'rds' }, // Alias lookup
              {
                id: 's2',
                service: 'Amazon Elastic Compute Cloud (Amazon EC2)',
              }, // Direct lookup
              { id: 's3', service: 'database' }, // Generic fallback
            ],
          },
        ],
      },
    };

    buildElkGraph(config);
    existSpy.mockRestore();
    readSpy.mockRestore();
  });

  it('should handle failed icon-map loading gracefully', () => {
    const readSpy = vitest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('Read failure');
    });
    const config: any = { version: '0.1', infrastructure: { clouds: [] } };
    buildElkGraph(config);
    readSpy.mockRestore();
  });

  it('should test fuzzy resolution and aliases', () => {
    // This will use the default ICON_MAP if loaded or empty
    const config: any = {
      version: '0.1',
      infrastructure: {
        clouds: [
          {
            provider: 'aws',
            services: [
              { id: 's1', service: 'ec2' }, // Alias: Amazon Elastic Compute Cloud (Amazon EC2)
              { id: 's2', service: 'MyElasticCompute' }, // Fuzzy
            ],
          },
        ],
      },
    };
    buildElkGraph(config);
  });

  it('should cover GCP icon resolution paths', () => {
    const config: any = {
      version: '0.1',
      infrastructure: {
        clouds: [
          {
            provider: 'gcp',
            services: [
              { id: 's1', service: 'compute-engine' },
              { id: 's2', service: 'gke' },
            ],
          },
        ],
      },
    };
    buildElkGraph(config);
  });
});
