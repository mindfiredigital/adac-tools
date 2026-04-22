/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => ({
  Range: class {
    constructor() {}
  },
  Position: class {
    constructor() {}
  },
  window: { showInformationMessage: vi.fn() },
  workspace: { getConfiguration: vi.fn() },
}));

import {
  wrapSvgInHtml,
  getLoadingHtml,
  getErrorHtml,
} from '../src/commands/preview-diagram';

describe('Preview HTML Helpers', () => {
  it('generates loading HTML', () => {
    const html = getLoadingHtml();
    expect(html).toContain('Generating diagram');
    expect(html).toContain('spinner');
  });

  it('generates error HTML', () => {
    const html = getErrorHtml('Some error', ['Log 1', 'Log 2']);
    expect(html).toContain('Some error');
    expect(html).toContain('Log 1');
    expect(html).toContain('Log 2');
  });

  it('generates error HTML without logs', () => {
    const html = getErrorHtml('Simple error');
    expect(html).toContain('Simple error');
    expect(html).toContain('Fix the YAML errors');
  });

  it('wraps SVG in HTML without optimizer result', () => {
    const html = wrapSvgInHtml('<svg>test</svg>', ['Log 1'], 100);
    expect(html).toContain('<svg>test</svg>');
    expect(html).toContain('100ms');
    expect(html).toContain('Log 1');
    // No optimizer panel dynamic content when no result provided
    expect(html).not.toContain('recommendation(s)');
    expect(html).not.toContain('architecture looks good');
  });

  it('wraps SVG with undefined optimizer result', () => {
    const html = wrapSvgInHtml('<svg/>', [], 50, undefined);
    expect(html).toContain('<svg/>');
    // No dynamic optimizer panel or clean badge
    expect(html).not.toContain('recommendation(s)');
    expect(html).not.toContain('architecture looks good');
  });

  it('shows clean badge when optimizer has zero recommendations', () => {
    const html = wrapSvgInHtml('<svg/>', [], 50, {
      recommendations: [],
      byService: {},
      summary: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
        total: 0,
        totalEstimatedSavingsUsd: 0,
      },
      analyzedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(html).toContain('opt-clean');
    expect(html).toContain('architecture looks good');
    expect(html).not.toContain('recommendation(s)');
  });

  it('renders optimizer panel with recommendations', () => {
    const html = wrapSvgInHtml('<svg/>', [], 120, {
      recommendations: [
        {
          id: 'sec-1',
          title: 'Encryption missing',
          description: 'RDS lacks encryption at rest',
          category: 'security',
          severity: 'critical',
          affectedResources: ['rds-main'],
          actionItems: ['Enable encryption', 'Rotate keys'],
          referenceUrl: 'https://docs.aws.amazon.com/rds/encryption',
        },
        {
          id: 'cost-1',
          title: 'RI opportunity',
          description: 'Consider reserved instances',
          category: 'cost',
          severity: 'medium',
          affectedResources: ['ec2-web'],
          actionItems: ['Evaluate RI plans'],
        },
      ],
      byService: {},
      summary: {
        critical: 1,
        high: 0,
        medium: 1,
        low: 0,
        info: 0,
        total: 2,
        totalEstimatedSavingsUsd: 0,
      },
      analyzedAt: '2026-01-01T00:00:00.000Z',
    });

    // Panel exists
    expect(html).toContain('optimizer-panel');
    expect(html).toContain('2 recommendation(s)');

    // Critical badge
    expect(html).toContain('badge-critical');
    expect(html).toContain('1 critical');

    // Medium badge
    expect(html).toContain('badge-medium');
    expect(html).toContain('1 medium');

    // No high / low badge content when counts are 0
    expect(html).not.toMatch(/\d+ high/);
    expect(html).not.toMatch(/\d+ low/);

    // Recommendation details
    expect(html).toContain('Encryption missing');
    expect(html).toContain('RDS lacks encryption at rest');
    expect(html).toContain('rds-main');
    expect(html).toContain('Enable encryption');
    expect(html).toContain('Rotate keys');
    expect(html).toContain('https://docs.aws.amazon.com/rds/encryption');
    expect(html).toContain('Learn more');

    // Second recommendation (no referenceUrl)
    expect(html).toContain('RI opportunity');
    expect(html).toContain('ec2-web');
    expect(html).toContain('Evaluate RI plans');

    // Severity colours
    expect(html).toContain('#f14c4c'); // critical colour
    expect(html).toContain('[CRITICAL]');
    expect(html).toContain('[MEDIUM]');
  });

  it('renders all severity badges when all present', () => {
    const html = wrapSvgInHtml('<svg/>', [], 50, {
      recommendations: [
        {
          id: 'r1',
          title: 'T1',
          description: 'D1',
          category: 'security',
          severity: 'critical',
          affectedResources: ['s1'],
          actionItems: ['A1'],
        },
        {
          id: 'r2',
          title: 'T2',
          description: 'D2',
          category: 'cost',
          severity: 'high',
          affectedResources: ['s2'],
          actionItems: ['A2'],
        },
        {
          id: 'r3',
          title: 'T3',
          description: 'D3',
          category: 'reliability',
          severity: 'low',
          affectedResources: ['s3'],
          actionItems: ['A3'],
        },
        {
          id: 'r4',
          title: 'T4',
          description: 'D4',
          category: 'architecture',
          severity: 'info',
          affectedResources: ['s4'],
          actionItems: ['A4'],
        },
      ],
      byService: {},
      summary: {
        critical: 1,
        high: 1,
        medium: 0,
        low: 1,
        info: 1,
        total: 4,
        totalEstimatedSavingsUsd: 0,
      },
      analyzedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(html).toContain('badge-critical');
    expect(html).toContain('badge-high');
    expect(html).toContain('badge-low');
    expect(html).toContain('2 low/info'); // low + info combined
    expect(html).toContain('4 recommendation(s)');
  });

  it('escapes HTML in recommendation fields', () => {
    const html = wrapSvgInHtml('<svg/>', [], 50, {
      recommendations: [
        {
          id: 'xss-1',
          title: '<script>alert("xss")</script>',
          description: 'Desc with <b>tags</b>',
          category: 'security',
          severity: 'high',
          affectedResources: ['svc-<injected>'],
          actionItems: ['Fix <this>'],
        },
      ],
      byService: {},
      summary: {
        critical: 0,
        high: 1,
        medium: 0,
        low: 0,
        info: 0,
        total: 1,
        totalEstimatedSavingsUsd: 0,
      },
      analyzedAt: '2026-01-01T00:00:00.000Z',
    });

    // Raw HTML should be escaped
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;tags&lt;/b&gt;');
    expect(html).toContain('svc-&lt;injected&gt;');
    expect(html).toContain('Fix &lt;this&gt;');
  });
});
