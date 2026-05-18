import * as vscode from 'vscode';

/**
 * Checks if the given document is an ADAC YAML file.
 *
 * @param {vscode.TextDocument} document - The document to check.
 * @returns {boolean} True if the document is an ADAC YAML file.
 */
export function isAdacDocument(document: vscode.TextDocument): boolean {
  const fileName = document.fileName.toLowerCase();
  return (
    document.languageId === 'adac-yaml' ||
    fileName.endsWith('.adac.yaml') ||
    fileName.endsWith('.adac.yml')
  );
}
