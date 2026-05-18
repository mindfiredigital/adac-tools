import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { isAdacDocument } from '../utils/adac-utils';

/**
 * Format the currently open ADAC YAML document.
 * Uses js-yaml to parse and re-dump with consistent formatting.
 */
export function registerFormatCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand(
    'adac.formatDocument',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor.');
        return;
      }

      const document = editor.document;
      if (!isAdacDocument(document)) {
        vscode.window.showWarningMessage(
          'This is not an ADAC YAML file. Expected .adac.yaml or .adac.yml extension.'
        );
        return;
      }

      const text = document.getText();

      try {
        const parsed = yaml.load(text);
        if (!parsed || typeof parsed !== 'object') {
          vscode.window.showWarningMessage(
            'Unable to parse YAML content for formatting.'
          );
          return;
        }

        const formatted = yaml.dump(parsed, {
          indent: 2,
          lineWidth: 120,
          noRefs: true,
          quotingType: "'",
          forceQuotes: false,
          sortKeys: false,
        });

        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(text.length)
        );

        const success = await editor.edit((editBuilder) => {
          editBuilder.replace(fullRange, formatted);
        });

        if (success) {
          vscode.window.showInformationMessage(
            '✅ ADAC file formatted successfully.'
          );
        } else {
          vscode.window.showErrorMessage(
            '❌ Failed to apply formatting. Ensure the file is not read-only.'
          );
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        vscode.window.showErrorMessage(`Failed to format: ${msg}`);
      }
    }
  );

  context.subscriptions.push(command);
}
