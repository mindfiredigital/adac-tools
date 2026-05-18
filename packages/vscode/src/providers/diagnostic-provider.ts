import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

const DEBOUNCE_MS = 500;

/**
 * DiagnosticProvider provides real-time validation for ADAC YAML files.
 * It validates both YAML syntax and ADAC schema structure.
 */
export class DiagnosticProvider implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> =
    new Map();
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.diagnosticCollection =
      vscode.languages.createDiagnosticCollection('adac');

    // Validate on open
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        if (this.isAdacFile(doc)) {
          this.validateDocument(doc);
        }
      })
    );

    // Validate on change (debounced)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (this.isAdacFile(event.document)) {
          const config = vscode.workspace.getConfiguration('adac');
          if (config.get<boolean>('validation.onType', true)) {
            this.validateDocumentDebounced(event.document);
          }
        }
      })
    );

    // Validate on save
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (this.isAdacFile(doc)) {
          const config = vscode.workspace.getConfiguration('adac');
          if (config.get<boolean>('validation.onSave', true)) {
            this.validateDocument(doc);
          }
        }
      })
    );

    // Clean up diagnostics when doc is closed
    this.disposables.push(
      vscode.workspace.onDidCloseTextDocument((doc) => {
        this.diagnosticCollection.delete(doc.uri);
      })
    );

    // Validate already-open ADAC documents
    for (const doc of vscode.workspace.textDocuments) {
      if (this.isAdacFile(doc)) {
        this.validateDocument(doc);
      }
    }
  }

  private isAdacFile(document: vscode.TextDocument): boolean {
    return (
      document.languageId === 'adac-yaml' ||
      document.fileName.endsWith('.adac.yaml') ||
      document.fileName.endsWith('.adac.yml')
    );
  }

  private validateDocumentDebounced(document: vscode.TextDocument): void {
    const uri = document.uri.toString();
    const existing = this.debounceTimers.get(uri);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.validateDocument(document);
      this.debounceTimers.delete(uri);
    }, DEBOUNCE_MS);

    this.debounceTimers.set(uri, timer);
  }

  public validateDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
    const config = vscode.workspace.getConfiguration('adac');
    if (!config.get<boolean>('validation.enabled', true)) {
      this.diagnosticCollection.delete(document.uri);
      return [];
    }

    const text = document.getText();
    const diagnostics: vscode.Diagnostic[] = [];

    // 1. YAML syntax validation
    try {
      const parsed = yaml.load(text);
      if (parsed && typeof parsed === 'object') {
        // 2. ADAC structural validation
        this.validateAdacStructure(
          parsed as Record<string, unknown>,
          document,
          diagnostics
        );
      }
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'mark' in e) {
        const yamlError = e as {
          mark?: { line?: number; column?: number };
          message?: string;
        };
        const line = yamlError.mark?.line ?? 0;
        const col = yamlError.mark?.column ?? 0;
        const range = new vscode.Range(line, col, line, col + 1);
        diagnostics.push(
          new vscode.Diagnostic(
            range,
            `YAML Syntax Error: ${yamlError.message || 'Invalid YAML'}`,
            vscode.DiagnosticSeverity.Error
          )
        );
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        const range = new vscode.Range(0, 0, 0, 1);
        diagnostics.push(
          new vscode.Diagnostic(
            range,
            `YAML Parse Error: ${msg}`,
            vscode.DiagnosticSeverity.Error
          )
        );
      }
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
    return diagnostics;
  }

  private validateAdacStructure(
    parsed: Record<string, unknown>,
    document: vscode.TextDocument,
    diagnostics: vscode.Diagnostic[]
  ): void {
    const text = document.getText();

    // Check required top-level keys
    if (!parsed['version']) {
      const range =
        this.findKeyRange(text, 'version') ?? new vscode.Range(0, 0, 0, 1);
      diagnostics.push(
        new vscode.Diagnostic(
          range,
          'Missing required field: "version"',
          vscode.DiagnosticSeverity.Error
        )
      );
    }

    if (!parsed['metadata']) {
      const range = new vscode.Range(0, 0, 0, 1);
      diagnostics.push(
        new vscode.Diagnostic(
          range,
          'Missing required field: "metadata"',
          vscode.DiagnosticSeverity.Error
        )
      );
    } else if (
      typeof parsed['metadata'] === 'object' &&
      parsed['metadata'] !== null
    ) {
      const metadata = parsed['metadata'] as Record<string, unknown>;

      if (!metadata['name']) {
        const range =
          this.findKeyRange(text, 'name', 'metadata') ??
          new vscode.Range(0, 0, 0, 1);
        diagnostics.push(
          new vscode.Diagnostic(
            range,
            'Missing required metadata field: "name"',
            vscode.DiagnosticSeverity.Error
          )
        );
      }

      if (!metadata['created']) {
        const range =
          this.findKeyRange(text, 'created', 'metadata') ??
          new vscode.Range(0, 0, 0, 1);
        diagnostics.push(
          new vscode.Diagnostic(
            range,
            'Missing required metadata field: "created"',
            vscode.DiagnosticSeverity.Warning
          )
        );
      }
    }

    if (!parsed['infrastructure']) {
      const range = new vscode.Range(0, 0, 0, 1);
      diagnostics.push(
        new vscode.Diagnostic(
          range,
          'Missing required field: "infrastructure"',
          vscode.DiagnosticSeverity.Error
        )
      );
    } else if (
      typeof parsed['infrastructure'] === 'object' &&
      parsed['infrastructure'] !== null
    ) {
      const infra = parsed['infrastructure'] as Record<string, unknown>;
      if (!infra['clouds'] || !Array.isArray(infra['clouds'])) {
        const range =
          this.findKeyRange(text, 'clouds') ?? new vscode.Range(0, 0, 0, 1);
        diagnostics.push(
          new vscode.Diagnostic(
            range,
            'Missing required field: "infrastructure.clouds" (must be an array)',
            vscode.DiagnosticSeverity.Error
          )
        );
      } else {
        // Validate each cloud
        for (const cloud of infra['clouds'] as Record<string, unknown>[]) {
          this.validateCloud(cloud, text, diagnostics);
        }
      }
    }

    // Validate unique IDs
    this.validateUniqueIds(parsed, text, diagnostics);

    // Validate connection references
    this.validateConnectionRefs(parsed, text, diagnostics);
  }

  private validateCloud(
    cloud: Record<string, unknown>,
    text: string,
    diagnostics: vscode.Diagnostic[]
  ): void {
    const cloudId = typeof cloud['id'] === 'string' ? cloud['id'] : '';

    if (!cloud['id'] || typeof cloud['id'] !== 'string') {
      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 1),
          'Cloud configuration missing required field: "id"',
          vscode.DiagnosticSeverity.Error
        )
      );
    }

    if (!cloud['provider']) {
      const range =
        this.findValueRange(text, cloudId) ?? new vscode.Range(0, 0, 0, 1);
      diagnostics.push(
        new vscode.Diagnostic(
          range,
          `Cloud "${cloudId || 'unknown'}" missing required field: "provider"`,
          vscode.DiagnosticSeverity.Error
        )
      );
    }

    if (!cloud['region']) {
      const range =
        this.findValueRange(text, cloudId) ?? new vscode.Range(0, 0, 0, 1);
      diagnostics.push(
        new vscode.Diagnostic(
          range,
          `Cloud "${cloudId || 'unknown'}" missing required field: "region"`,
          vscode.DiagnosticSeverity.Error
        )
      );
    }

    // Validate services in cloud
    if (Array.isArray(cloud['services'])) {
      for (const svc of cloud['services'] as Record<string, unknown>[]) {
        if (!svc['id']) {
          diagnostics.push(
            new vscode.Diagnostic(
              new vscode.Range(0, 0, 0, 1),
              'Service missing required field: "id"',
              vscode.DiagnosticSeverity.Error
            )
          );
        }
      }
    }
  }

  private validateUniqueIds(
    parsed: Record<string, unknown>,
    text: string,
    diagnostics: vscode.Diagnostic[]
  ): void {
    const ids = new Map<string, number>();

    const collectId = (id: string) => {
      ids.set(id, (ids.get(id) || 0) + 1);
    };

    // Collect application IDs
    if (Array.isArray(parsed['applications'])) {
      for (const app of parsed['applications'] as Record<string, unknown>[]) {
        if (app['id'] && typeof app['id'] === 'string') {
          collectId(app['id']);
        }
      }
    }

    // Collect service IDs
    const infra = parsed['infrastructure'] as
      | Record<string, unknown>
      | undefined;
    if (infra && Array.isArray(infra['clouds'])) {
      for (const cloud of infra['clouds'] as Record<string, unknown>[]) {
        if (cloud['id'] && typeof cloud['id'] === 'string') {
          collectId(cloud['id']);
        }
        if (Array.isArray(cloud['services'])) {
          for (const svc of cloud['services'] as Record<string, unknown>[]) {
            if (svc['id'] && typeof svc['id'] === 'string') {
              collectId(svc['id']);
            }
          }
        }
      }
    }

    // Collect connection IDs
    if (Array.isArray(parsed['connections'])) {
      for (const conn of parsed['connections'] as Record<string, unknown>[]) {
        if (conn['id'] && typeof conn['id'] === 'string') {
          collectId(conn['id']);
        }
      }
    }

    // Report duplicates
    for (const [id, count] of ids.entries()) {
      if (count > 1) {
        const range =
          this.findValueRange(text, id) ?? new vscode.Range(0, 0, 0, 1);
        diagnostics.push(
          new vscode.Diagnostic(
            range,
            `Duplicate ID: "${id}" appears ${count} times. IDs must be unique.`,
            vscode.DiagnosticSeverity.Error
          )
        );
      }
    }
  }

  private validateConnectionRefs(
    parsed: Record<string, unknown>,
    text: string,
    diagnostics: vscode.Diagnostic[]
  ): void {
    // Collect all known IDs
    const knownIds = new Set<string>();

    if (Array.isArray(parsed['applications'])) {
      for (const app of parsed['applications'] as Record<string, unknown>[]) {
        if (app['id'] && typeof app['id'] === 'string') {
          knownIds.add(app['id']);
        }
      }
    }

    const infra = parsed['infrastructure'] as
      | Record<string, unknown>
      | undefined;
    if (infra && Array.isArray(infra['clouds'])) {
      for (const cloud of infra['clouds'] as Record<string, unknown>[]) {
        if (cloud['id'] && typeof cloud['id'] === 'string') {
          knownIds.add(cloud['id']);
        }
        if (Array.isArray(cloud['services'])) {
          for (const svc of cloud['services'] as Record<string, unknown>[]) {
            if (svc['id'] && typeof svc['id'] === 'string') {
              knownIds.add(svc['id']);
            }
          }
        }
      }
    }

    // Check connection refs
    if (Array.isArray(parsed['connections'])) {
      for (const conn of parsed['connections'] as Record<string, unknown>[]) {
        const from = conn['from'] as string | undefined;
        const to = conn['to'] as string | undefined;
        const connId = conn['id'] as string | undefined;

        if (from && !knownIds.has(from)) {
          const range =
            this.findValueRange(text, from) ?? new vscode.Range(0, 0, 0, 1);
          diagnostics.push(
            new vscode.Diagnostic(
              range,
              `Connection "${connId || '?'}" references unknown "from" ID: "${from}"`,
              vscode.DiagnosticSeverity.Warning
            )
          );
        }

        if (to && !knownIds.has(to)) {
          const range =
            this.findValueRange(text, to) ?? new vscode.Range(0, 0, 0, 1);
          diagnostics.push(
            new vscode.Diagnostic(
              range,
              `Connection "${connId || '?'}" references unknown "to" ID: "${to}"`,
              vscode.DiagnosticSeverity.Warning
            )
          );
        }
      }
    }
  }

  private findKeyRange(
    text: string,
    key: string,
    parentKey?: string
  ): vscode.Range | null {
    const lines = text.split('\n');
    const keyRegex = new RegExp(`^(\\s*)${key}\\s*:`);

    let inParentSection = !parentKey;
    let parentIndent = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const indentMatch = line.match(/^(\s*)/);
      const currentIndent = indentMatch ? indentMatch[1].length : 0;

      if (parentKey && !inParentSection) {
        if (line.trim().startsWith(`${parentKey}:`)) {
          inParentSection = true;
          parentIndent = currentIndent;
        }
        continue;
      }

      if (parentKey && inParentSection) {
        // Exit parent section if we hit a line with less or equal indent than the parent
        if (
          line.trim() !== '' &&
          currentIndent <= parentIndent &&
          !line.trim().startsWith(`${parentKey}:`)
        ) {
          inParentSection = false;
          // Continue searching if we might find another parent section
          continue;
        }

        const match = keyRegex.exec(line);
        if (match && currentIndent > parentIndent) {
          const startCol = match[1].length;
          return new vscode.Range(i, startCol, i, startCol + key.length);
        }
      } else if (!parentKey) {
        const match = keyRegex.exec(line);
        if (match) {
          const startCol = match[1].length;
          return new vscode.Range(i, startCol, i, startCol + key.length);
        }
      }
    }
    return null;
  }

  private findValueRange(text: string, value: string): vscode.Range | null {
    if (!value || typeof value !== 'string') {
      return null;
    }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const index = lines[i].indexOf(value);
      if (index !== -1) {
        const line = lines[i];
        const prevChar = index > 0 ? line[index - 1] : '';
        const curChar =
          index + value.length < line.length ? line[index + value.length] : '';

        let start = index;
        let length = value.length;

        if (
          (prevChar === "'" && curChar === "'") ||
          (prevChar === '"' && curChar === '"')
        ) {
          start -= 1;
          length += 2;
        }

        return new vscode.Range(i, start, i, start + length);
      }
    }
    return null;
  }

  dispose(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.diagnosticCollection.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
