import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { CompletionProvider } from '../src/providers/completion-provider';

vi.mock('vscode', () => {
  return {
    CompletionItem: class {
      constructor(
        public label: string,
        public kind: any
      ) {}
    },
    languages: {
      createDiagnosticCollection: vi.fn().mockReturnValue({
        set: vi.fn(),
        delete: vi.fn(),
        dispose: vi.fn(),
      }),
    },
    workspace: {
      workspaceFolders: undefined,
      textDocuments: [],
      onDidOpenTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onDidChangeTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onDidSaveTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onDidCloseTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      getConfiguration: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue(true),
      }),
    },
    Diagnostic: class {
      constructor(
        public range: any,
        public message: string,
        public severity: any
      ) {}
    },
    DiagnosticSeverity: {
      Error: 0,
      Warning: 1,
      Information: 2,
      Hint: 3,
    },
    DiagnosticCollection: class {},
    CompletionItemKind: {
      Property: 0,
      Value: 1,
      Module: 2,
      Keyword: 3,
      Snippet: 4,
      EnumMember: 5,
      Reference: 6,
    },
    SnippetString: class {
      constructor(public value: string) {}
    },
    Hover: class {
      constructor(public contents: any) {}
    },
    MarkdownString: class {
      constructor(public value: string) {}
    },
    Range: class {
      constructor(
        public startLine: number,
        public startCol: number,
        public endLine: number,
        public endCol: number
      ) {}
    },
    Position: class {
      constructor(
        public line: number,
        public character: number
      ) {}
    },
    Uri: {
      parse: vi.fn().mockImplementation((s: string) => ({ toString: () => s })),
    },
  };
});

import { CompletionProvider } from '../src/providers/completion-provider';
import { DiagnosticProvider } from '../src/providers/diagnostic-provider';

describe('CompletionProvider', () => {
  let provider: CompletionProvider;

  beforeEach(() => {
    provider = new CompletionProvider();
  });

  it('provides root level completions', async () => {
    const mockDocument: any = {
      lineAt: (i: number) => ({ text: '' }),
      getText: () => 'version: "0.1"\n',
    };
    const mockPosition: any = new vscode.Position(1, 0);

    const items = await provider.provideCompletionItems(
      mockDocument,
      mockPosition,
      {} as any,
      {} as any
    );

    expect(items).toBeDefined();
    const labels = (items as any).map((i: any) => i.label);
    expect(labels).toContain('metadata');
    expect(labels).toContain('infrastructure');
  });

  it('detects gcp provider and offers gcp services', async () => {
    const lines = ['provider: gcp', 'services:', '  - id: s1', '    service: '];
    const mockDocument: any = {
      lineAt: (i: number) => ({ text: lines[i] || '' }),
      getText: () => lines.join('\n'),
    };
    const mockPosition: any = new vscode.Position(3, 13);

    const items = await provider.provideCompletionItems(
      mockDocument,
      mockPosition,
      {} as any,
      {} as any
    );

    const labels = (items as any).map((i: any) => i.label);
    expect(labels).toContain('gke');
    expect(labels).toContain('cloud-run');
  });

  it('collects IDs for from/to completions', async () => {
    const lines = [
      'services:',
      '  - id: s1',
      '  - id: s2',
      'connections:',
      '    from: ',
    ];
    const mockDocument: any = {
      lineAt: (i: number) => ({ text: lines[i] || '' }),
      getText: () => lines.join('\n'),
    };
    const mockPosition: any = new vscode.Position(4, 10);

    const items = await provider.provideCompletionItems(
      mockDocument,
      mockPosition,
      {} as any,
      {} as any
    );

    const labels = (items as any).map((i: any) => i.label);
    expect(labels).toContain('s1');
    expect(labels).toContain('s2');
  });
});

describe('DiagnosticProvider', () => {
  let provider: DiagnosticProvider;

  beforeEach(() => {
    provider = new DiagnosticProvider();
  });

  it('validates a simple valid ADAC document', () => {
    const mockDocument: any = {
      uri: { toString: () => 'test://test' },
      getText: () => `
version: '0.1'
metadata:
  name: test
  created: 2023-01-01
infrastructure:
  clouds:
    - id: cloud1
      provider: aws
      region: us-east-1
`,
      lineAt: (i: number) => ({ text: '' }),
    };

    const diagnostics = provider.validateDocument(mockDocument);
    // Find errors
    const errors = diagnostics.filter((d) => d.severity === 0);
    expect(errors.length).toBe(0);
  });

  it('reports missing version', () => {
    const mockDocument: any = {
      uri: { toString: () => 'test://test' },
      getText: () => `
metadata:
  name: test
infrastructure:
  clouds: []
`,
      lineAt: (i: number) => ({ text: '' }),
    };

    const diagnostics = provider.validateDocument(mockDocument);
    expect(diagnostics.some((d) => d.message.includes('version'))).toBe(true);
  });

  it('handles invalid YAML', () => {
    const mockDocument: any = {
      uri: { toString: () => 'test://test' },
      getText: () => `
version: '0.1'
  invalid: yaml: structure:
`,
      lineAt: (i: number) => ({ text: '' }),
    };

    const diagnostics = provider.validateDocument(mockDocument);
    expect(diagnostics.length).toBeGreaterThan(0);
  });

  it('identifies adac files correctly', () => {
    const isAdac = (provider as any).isAdacFile({
      languageId: 'adac-yaml',
      fileName: 'test.yaml',
    });
    expect(isAdac).toBe(true);

    const isAdac2 = (provider as any).isAdacFile({
      languageId: 'yaml',
      fileName: 'test.adac.yml',
    });
    expect(isAdac2).toBe(true);
  });
});

import { getErrorHtml } from '../src/commands/preview-diagram';

describe('Preview Helpers', () => {
  it('generates error HTML', () => {
    const html = getErrorHtml('Test Error');
    expect(html).toContain('Test Error');
    expect(html).toContain('Error');
  });
});

import { HoverProvider } from '../src/providers/hover-provider';

describe('HoverProvider', () => {
  let provider: HoverProvider;

  beforeEach(() => {
    provider = new HoverProvider();
  });

  it('provides hover information for known keys', () => {
    const mockDocument: any = {
      getText: () => 'version: "0.1"',
      lineAt: () => ({ text: 'version: "0.1"' }),
      getWordRangeAtPosition: () => new vscode.Range(0, 0, 0, 7),
    };
    const mockPosition: any = new vscode.Position(0, 0);

    const hover = provider.provideHover(mockDocument, mockPosition, {} as any);
    expect(hover).toBeDefined();
  });
});
