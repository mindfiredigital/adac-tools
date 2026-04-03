import * as vscode from 'vscode';
import { DiagnosticProvider } from './providers/diagnostic-provider';
import { CompletionProvider } from './providers/completion-provider';
import { HoverProvider } from './providers/hover-provider';
import { registerValidateCommand } from './commands/validate';
import { registerFormatCommand } from './commands/format';
import { registerPreviewDiagramCommand } from './commands/preview-diagram';
import { isAdacDocument } from './utils/adac-utils';

/**
 * Extension activation entry point.
 * Called when VS Code detects an ADAC YAML file or the workspaceContains event fires.
 */
export function activate(context: vscode.ExtensionContext): void {
  // console.log('[adac-vscode] Activating ADAC extension...');

  // --- Document selector for .adac.yaml / .adac.yml files ---
  const adacSelector: vscode.DocumentSelector = [
    { language: 'adac-yaml' },
    { scheme: 'file', pattern: '**/*.adac.yaml' },
    { scheme: 'file', pattern: '**/*.adac.yml' },
  ];

  // --- Providers ---
  // 1. Diagnostic provider (inline validation)
  const diagnosticProvider = new DiagnosticProvider();
  context.subscriptions.push(diagnosticProvider);

  // 2. Completion provider (IntelliSense)
  const completionProvider = new CompletionProvider();
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      adacSelector,
      completionProvider,
      ':',
      ' ',
      '-',
      "'",
      '"'
    )
  );

  // 3. Hover provider (tooltips)
  const hoverProvider = new HoverProvider();
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(adacSelector, hoverProvider)
  );

  // --- Commands ---
  registerValidateCommand(context, diagnosticProvider);
  registerFormatCommand(context);
  registerPreviewDiagramCommand(context);

  // --- Status bar item ---
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = '$(cloud) ADAC';
  statusBarItem.tooltip = 'ADAC - Architecture Diagram as Code';
  statusBarItem.command = 'adac.validate';
  context.subscriptions.push(statusBarItem);

  // Show status bar when ADAC file is active
  const updateStatusBar = () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && isAdacDocument(editor.document)) {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateStatusBar)
  );
  updateStatusBar();

  // console.log('[adac-vscode] Extension activated successfully.');
}

/**
 * Extension deactivation.
 */
export function deactivate(): void {
  // console.log('[adac-vscode] Extension deactivated.');
}
