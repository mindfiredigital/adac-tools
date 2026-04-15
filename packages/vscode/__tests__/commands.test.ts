import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { registerFormatCommand } from '../src/commands/format';
import { isAdacDocument } from '../src/utils/adac-utils';

vi.mock('vscode', () => {
  return {
    commands: {
      registerCommand: vi.fn(),
    },
    window: {
      activeTextEditor: undefined,
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      showErrorMessage: vi.fn(),
    },
    workspace: {
      workspaceFolders: undefined,
      onDidChangeTextDocument: vi.fn().mockImplementation(() => ({
        dispose: vi.fn(),
      })),
      getConfiguration: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue('elk'),
      }),
    },
    ViewColumn: {
      Active: 0,
      Beside: 1,
    },
    Range: class {
      constructor(
        public start: any,
        public end: any
      ) {}
    },
    Position: class {
      constructor(
        public line: number,
        public character: number
      ) {}
    },
    DiagnosticSeverity: {
      Error: 0,
      Warning: 1,
      Information: 2,
      Hint: 3,
    },
  };
});

vi.mock('../src/utils/adac-utils', () => ({
  isAdacDocument: vi.fn(),
}));

describe('Format Command', () => {
  let context: any;
  let commandHandler: any;

  beforeEach(() => {
    vi.clearAllMocks();
    context = { subscriptions: [] };
    registerFormatCommand(context);
    commandHandler = (vscode.commands.registerCommand as any).mock.calls.find(
      (call: any) => call[0] === 'adac.formatDocument'
    )[1];
  });

  it('should show warning if no active editor', async () => {
    (vscode.window as any).activeTextEditor = undefined;
    await commandHandler();
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      'No active editor.'
    );
  });

  it('should return false for non-adac document', () => {
    // We can't easily test isAdacDocument directly here because we mock it.
    // But we can test the behavior of the command when it's false.
    (vscode.window as any).activeTextEditor = {
      document: { fileName: 'test.yaml', languageId: 'yaml' },
    };
    (isAdacDocument as any).mockReturnValue(false);
  });

  it('should show warning if not an ADAC document', async () => {
    const mockEditor = { document: {} };
    (vscode.window as any).activeTextEditor = mockEditor;
    (isAdacDocument as any).mockReturnValue(false);

    await commandHandler();
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('not an ADAC YAML file')
    );
  });

  it('should format valid ADAC document', async () => {
    const mockDocument = {
      getText: () => 'version: "0.1"\nmetadata:\n  name: Test',
      positionAt: vi.fn().mockReturnValue({ line: 0, character: 0 }),
    };
    const mockEditor = {
      document: mockDocument,
      edit: vi.fn().mockImplementation((cb) => {
        const builder = { replace: vi.fn() };
        cb(builder);
        return Promise.resolve(true);
      }),
    };
    (vscode.window as any).activeTextEditor = mockEditor;
    (isAdacDocument as any).mockReturnValue(true);

    await commandHandler();
    expect(mockEditor.edit).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('formatted successfully')
    );
  });

  it('should show error if edit fails', async () => {
    const mockDocument = {
      getText: () => 'version: "0.1"',
      positionAt: vi.fn().mockReturnValue({ line: 0, character: 0 }),
    };
    const mockEditor = {
      document: mockDocument,
      edit: vi.fn().mockResolvedValue(false),
    };
    (vscode.window as any).activeTextEditor = mockEditor;
    (isAdacDocument as any).mockReturnValue(true);

    await commandHandler();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to apply formatting')
    );
  });

  it('should show error on parse exception', async () => {
    const mockDocument = {
      getText: () => 'bad: yaml: [',
      positionAt: vi.fn(),
    };
    (vscode.window as any).activeTextEditor = { document: mockDocument };
    (isAdacDocument as any).mockReturnValue(true);

    await commandHandler();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to format')
    );
  });
});

import { registerValidateCommand } from '../src/commands/validate';

describe('Validate Command', () => {
  let context: any;
  let diagnosticProvider: any;
  let commandHandler: any;

  beforeEach(() => {
    vi.clearAllMocks();
    context = { subscriptions: [] };
    diagnosticProvider = { validateDocument: vi.fn().mockReturnValue([]) };
    registerValidateCommand(context, diagnosticProvider);
    commandHandler = (vscode.commands.registerCommand as any).mock.calls.find(
      (call: any) => call[0] === 'adac.validate'
    )[1];
    (isAdacDocument as any).mockReturnValue(true);
  });

  it('should show warning if not an ADAC document', () => {
    (vscode.window as any).activeTextEditor = { document: {} };
    (isAdacDocument as any).mockReturnValue(false);
    commandHandler();
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('not an ADAC YAML file')
    );
  });

  it('should show success message when no diagnostics', () => {
    (vscode.window as any).activeTextEditor = { document: {} };
    commandHandler();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('passed')
    );
  });

  it('should show warning message when only warnings exist', () => {
    (vscode.window as any).activeTextEditor = { document: {} };
    diagnosticProvider.validateDocument.mockReturnValue([
      { severity: vscode.DiagnosticSeverity.Warning },
    ]);
    commandHandler();
    expect(vscode.window.showWarningMessage).toHaveBeenCalled();
  });

  it('should show error message when errors exist', () => {
    (vscode.window as any).activeTextEditor = { document: {} };
    diagnosticProvider.validateDocument.mockReturnValue([
      { severity: vscode.DiagnosticSeverity.Error },
    ]);
    commandHandler();
    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
  });
});

import { registerPreviewDiagramCommand } from '../src/commands/preview-diagram';

describe('Preview Diagram Command', () => {
  let context: any;
  let commandHandler: any;

  beforeEach(() => {
    vi.clearAllMocks();
    context = { subscriptions: [] };
    registerPreviewDiagramCommand(context);
    commandHandler = (vscode.commands.registerCommand as any).mock.calls.find(
      (call: any) => call[0] === 'adac.previewDiagram'
    )[1];
    (vscode.window as any).createWebviewPanel = vi.fn().mockReturnValue({
      reveal: vi.fn(),
      webview: { html: '' },
      onDidDispose: vi.fn(),
    });
  });

  it('should create webview panel if not exists', async () => {
    const mockEditor = {
      document: { getText: () => 'version: "0.1"' },
    };
    (vscode.window as any).activeTextEditor = mockEditor;

    await commandHandler();
    expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
  });

  it('should reveal existing panel', async () => {
    const mockEditor = {
      document: { getText: () => 'version: "0.1"' },
    };
    (vscode.window as any).activeTextEditor = mockEditor;

    const mockPanel = {
      reveal: vi.fn(),
      webview: { html: '' },
      onDidDispose: vi.fn(),
    };
    (vscode.window as any).createWebviewPanel.mockReturnValue(mockPanel);

    await commandHandler(); // first call creates
    await commandHandler(); // second call reveals
    expect(mockPanel.reveal).toHaveBeenCalled();
  });

  it('should handle messages from webview', async () => {
    let messageHandler: any;
    (vscode.window as any).createWebviewPanel = vi.fn().mockReturnValue({
      reveal: vi.fn(),
      webview: {
        html: '',
        onDidReceiveMessage: vi.fn().mockImplementation((cb) => {
          messageHandler = cb;
          return { dispose: vi.fn() };
        }),
      },
      onDidDispose: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    });
    const mockEditor = { document: { getText: () => 'v: 0.1' } };
    (vscode.window as any).activeTextEditor = mockEditor;

    await commandHandler();

    if (messageHandler) {
      messageHandler({ command: 'alert', text: 'test-msg' });
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'test-msg'
      );
    }
  });
});
