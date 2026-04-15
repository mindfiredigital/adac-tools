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

  it('wraps SVG in HTML', () => {
    const html = wrapSvgInHtml('<svg>test</svg>', ['Log 1'], 100);
    expect(html).toContain('<svg>test</svg>');
    expect(html).toContain('100ms');
    expect(html).toContain('Log 1');
  });
});
