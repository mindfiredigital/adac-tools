import * as vscode from 'vscode';
import { DiagnosticProvider } from '../providers/diagnostic-provider';
import { isAdacDocument } from '../utils/adac-utils';

/**
 * Validate the currently open ADAC YAML file and show results in a notification.
 */
export function registerValidateCommand(
  context: vscode.ExtensionContext,
  diagnosticProvider: DiagnosticProvider
): void {
  const command = vscode.commands.registerCommand('adac.validate', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage(
        'No active editor. Open an ADAC YAML file first.'
      );
      return;
    }

    const document = editor.document;
    if (!isAdacDocument(document)) {
      vscode.window.showWarningMessage(
        'This is not an ADAC YAML file. Expected .adac.yaml or .adac.yml extension.'
      );
      return;
    }

    const diagnostics = diagnosticProvider.validateDocument(document);

    const errors = diagnostics.filter(
      (d) => d.severity === vscode.DiagnosticSeverity.Error
    );
    const warnings = diagnostics.filter(
      (d) => d.severity === vscode.DiagnosticSeverity.Warning
    );

    if (errors.length === 0 && warnings.length === 0) {
      vscode.window.showInformationMessage(
        '✅ ADAC validation passed! No issues found.'
      );
    } else if (errors.length === 0) {
      vscode.window.showWarningMessage(
        `⚠️ ADAC validation: ${warnings.length} warning(s) found. Check the Problems panel.`
      );
    } else {
      vscode.window.showErrorMessage(
        `❌ ADAC validation failed: ${errors.length} error(s), ${warnings.length} warning(s). Check the Problems panel.`
      );
    }
  });

  context.subscriptions.push(command);
}
