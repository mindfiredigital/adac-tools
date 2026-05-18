import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Use the same generation pipeline as the CLI
let generateDiagramSvg:
  | typeof import('@mindfiredigital/adac-core').generateDiagramSvg
  | undefined;

/**
 * Find the adac-tools monorepo root by checking workspace folders
 * for the presence of `packages/icons-aws`. This is needed because
 * the ELK builder resolves icon maps and icon file paths relative
 * to `process.cwd()`.
 */
function findMonorepoRoot(): string | undefined {
  // 1. Check VS Code workspace folders
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const rootPath = folder.uri.fsPath;
      // Direct match: workspace IS the monorepo root
      if (
        fs.existsSync(
          path.join(
            rootPath,
            'packages',
            'icons-aws',
            'mappings',
            'icon-map.json'
          )
        )
      ) {
        return rootPath;
      }
      // Workspace might be a subdirectory of the monorepo
      let dir = rootPath;
      for (let i = 0; i < 5; i++) {
        const parent = path.dirname(dir);
        if (parent === dir) break;
        if (
          fs.existsSync(
            path.join(
              parent,
              'packages',
              'icons-aws',
              'mappings',
              'icon-map.json'
            )
          )
        ) {
          return parent;
        }
        dir = parent;
      }
    }
  }

  // 2. Fallback: check if process.cwd() already works
  if (
    fs.existsSync(
      path.join(
        process.cwd(),
        'packages',
        'icons-aws',
        'mappings',
        'icon-map.json'
      )
    )
  ) {
    return process.cwd();
  }

  return undefined;
}

/**
 * Execute a function with process.cwd() temporarily changed to the monorepo root.
 * This is required because the ELK builder resolves icon maps and assets using process.cwd().
 */
async function withMonorepoCwd<T>(fn: () => Promise<T>): Promise<T> {
  const monorepoRoot = findMonorepoRoot();
  const originalCwd = process.cwd();

  if (monorepoRoot && monorepoRoot !== originalCwd) {
    process.chdir(monorepoRoot);
  }

  try {
    return await fn();
  } finally {
    // Restore original cwd
    if (process.cwd() !== originalCwd) {
      try {
        process.chdir(originalCwd);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Lazy-load adac-core with correct cwd so icon maps load properly.
 * The ELK builder loads icon-map.json at module init time using process.cwd().
 */
async function getGenerateDiagramSvg() {
  if (generateDiagramSvg) return generateDiagramSvg;

  // Change cwd BEFORE importing so the module-init icon map loading works
  return withMonorepoCwd(async () => {
    try {
      const core = await import('@mindfiredigital/adac-core');
      generateDiagramSvg = core.generateDiagramSvg;
      return generateDiagramSvg;
    } catch {
      return undefined;
    }
  });
}

/**
 * Preview Diagram command that renders the ADAC architecture using the
 * exact same pipeline as the CLI (`@mindfiredigital/adac-core.generateDiagramSvg`).
 *
 * This ensures visual parity between CLI-generated and VS Code-previewed diagrams.
 */
export function registerPreviewDiagramCommand(
  context: vscode.ExtensionContext
): void {
  let currentPanel: vscode.WebviewPanel | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let lastRenderSequence = 0;

  const command = vscode.commands.registerCommand(
    'adac.previewDiagram',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage(
          'No active editor. Open an ADAC YAML file first.'
        );
        return;
      }

      const document = editor.document;

      if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Beside);
      } else {
        currentPanel = vscode.window.createWebviewPanel(
          'adacDiagramPreview',
          'ADAC Diagram Preview',
          vscode.ViewColumn.Beside,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        currentPanel.onDidDispose(() => {
          currentPanel = undefined;
        });
      }

      // Show loading state
      currentPanel.webview.html = getLoadingHtml();

      const sequence = ++lastRenderSequence;
      await updatePreview(
        currentPanel,
        document,
        sequence,
        () => lastRenderSequence
      );

      // Update on document change (debounced to 800ms to avoid layout thrash)
      const changeDisposable = vscode.workspace.onDidChangeTextDocument(
        (event) => {
          if (event.document === document && currentPanel) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              const sequence = ++lastRenderSequence;
              updatePreview(
                currentPanel!,
                document,
                sequence,
                () => lastRenderSequence
              );
            }, 800);
          }
        }
      );

      currentPanel.onDidDispose(() => {
        changeDisposable.dispose();
        if (debounceTimer) clearTimeout(debounceTimer);
      });
    }
  );

  context.subscriptions.push(command);
}

async function updatePreview(
  panel: vscode.WebviewPanel,
  document: vscode.TextDocument,
  sequence: number,
  getLatestSequence: () => number
): Promise<void> {
  const text = document.getText();

  const generate = await getGenerateDiagramSvg();
  if (!generate) {
    panel.webview.html = getErrorHtml(
      'Could not load @mindfiredigital/adac-core. Make sure the monorepo is built (`pnpm build`).'
    );
    return;
  }

  try {
    // Read layout engine preference from VS Code settings
    const config = vscode.workspace.getConfiguration('adac');
    const layoutEngine = config.get<'elk' | 'dagre'>(
      'diagram.layoutEngine',
      'elk'
    );
    const skipOptimizer = !config.get<boolean>('diagram.optimize', true);

    // Run generation with cwd set to monorepo root so icon paths resolve correctly
    const result = await withMonorepoCwd(() =>
      generate(
        text,
        layoutEngine,
        false, // validate
        undefined, // costData
        'monthly', // period
        skipOptimizer
      )
    );

    // Only update if this is still the latest request
    if (sequence === getLatestSequence()) {
      panel.webview.html = wrapSvgInHtml(
        result.svg,
        result.logs,
        result.duration,
        result.optimizationResult
      );
    }
  } catch (e: unknown) {
    if (sequence === getLatestSequence()) {
      const msg = e instanceof Error ? e.message : String(e);
      const logs = (e as Error & { logs?: string[] })?.logs;
      panel.webview.html = getErrorHtml(msg, logs);
    }
  }
}

export function wrapSvgInHtml(
  svg: string,
  logs: string[],
  durationMs: number,
  optimizationResult?: import('@mindfiredigital/adac-optimizer').OptimizationResult
): string {
  const logsHtml = logs
    .map((l) => `<div class="log-line">${escapeHtml(l)}</div>`)
    .join('\n');

  // ── Optimizer panel ────────────────────────────────────────────────────────
  let optimizerHtml = '';
  if (optimizationResult && optimizationResult.summary.total > 0) {
    const s = optimizationResult.summary;
    const SEVERITY_COLOR: Record<string, string> = {
      critical: '#f14c4c',
      high: '#e8a838',
      medium: '#cca700',
      low: '#3794ff',
      info: '#858585',
    };
    const SEVERITY_ICON: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵',
      info: '⚪',
    };

    const recItems = optimizationResult.recommendations
      .map((rec) => {
        const color = SEVERITY_COLOR[rec.severity] ?? '#858585';
        const icon = SEVERITY_ICON[rec.severity] ?? '•';
        const actions = rec.actionItems
          .map((a) => `<li>${escapeHtml(a)}</li>`)
          .join('');
        return `
        <details class="rec-item">
          <summary style="color:${color}">
            ${icon} <strong>[${escapeHtml(rec.severity.toUpperCase())}]</strong>
            ${escapeHtml(rec.category)} — ${escapeHtml(rec.title)}
            <span class="rec-resources">(${rec.affectedResources.map(escapeHtml).join(', ')})</span>
          </summary>
          <p class="rec-desc">${escapeHtml(rec.description)}</p>
          <ul class="rec-actions">${actions}</ul>
          ${rec.referenceUrl ? `<a class="rec-link" href="${escapeHtml(rec.referenceUrl)}" target="_blank">📖 Learn more</a>` : ''}
        </details>`;
      })
      .join('');

    optimizerHtml = `
    <details class="opt-panel" id="optimizer-panel">
      <summary class="opt-summary">
        🔍 Optimizer — ${s.total} recommendation(s)
        ${s.critical > 0 ? `<span class="badge badge-critical">${s.critical} critical</span>` : ''}
        ${s.high > 0 ? `<span class="badge badge-high">${s.high} high</span>` : ''}
        ${s.medium > 0 ? `<span class="badge badge-medium">${s.medium} medium</span>` : ''}
        ${s.low + s.info > 0 ? `<span class="badge badge-low">${s.low + s.info} low/info</span>` : ''}
      </summary>
      <div class="rec-list">${recItems}</div>
    </details>`;
  } else if (optimizationResult) {
    optimizerHtml = `<div class="opt-clean">✅ Optimizer: No recommendations — architecture looks good!</div>`;
  }
  // ──────────────────────────────────────────────────────────────────────────

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ADAC Diagram Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--vscode-editor-background, #fff);
      color: var(--vscode-editor-foreground, #222);
      padding: 0;
      overflow: auto;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 16px;
      background: var(--vscode-editorWidget-background, #f3f3f3);
      border-bottom: 1px solid var(--vscode-panel-border, #ddd);
      font-size: 12px;
    }
    .toolbar-left { display: flex; align-items: center; gap: 12px; }
    .toolbar-right { display: flex; align-items: center; gap: 8px; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-time {
      background: var(--vscode-badge-background, #007acc);
      color: var(--vscode-badge-foreground, #fff);
    }
    .badge-critical { background: #f14c4c22; color: #f14c4c; }
    .badge-high     { background: #e8a83822; color: #e8a838; }
    .badge-medium   { background: #cca70022; color: #cca700; }
    .badge-low      { background: #3794ff22; color: #3794ff; }
    .btn {
      padding: 3px 10px;
      border: 1px solid var(--vscode-button-border, #ccc);
      border-radius: 4px;
      background: var(--vscode-button-secondaryBackground, #eee);
      color: var(--vscode-button-secondaryForeground, #222);
      font-size: 11px;
      cursor: pointer;
    }
    .btn:hover { background: var(--vscode-button-secondaryHoverBackground, #ddd); }
    .diagram-container {
      padding: 8px;
      overflow: auto;
    }
    .diagram-container svg {
      width: 100%;
      height: auto;
      max-width: 100%;
    }
    /* ── Optimizer panel ────────────────────────────────────────── */
    .opt-panel {
      border-top: 2px solid var(--vscode-panel-border, #ddd);
      font-size: 12px;
    }
    .opt-summary {
      cursor: pointer;
      padding: 8px 16px;
      background: var(--vscode-editorWidget-background, #f3f3f3);
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;
      list-style: none;
      font-weight: 600;
    }
    .opt-summary::marker, .opt-summary::-webkit-details-marker { display: none; }
    .opt-clean {
      padding: 8px 16px;
      font-size: 12px;
      color: #4caf50;
      border-top: 1px solid var(--vscode-panel-border, #ddd);
    }
    .rec-list { padding: 8px 16px 12px; display: flex; flex-direction: column; gap: 6px; }
    .rec-item {
      border: 1px solid var(--vscode-panel-border, #ddd);
      border-radius: 4px;
      overflow: hidden;
    }
    .rec-item > summary {
      padding: 6px 10px;
      cursor: pointer;
      background: var(--vscode-editorHoverWidget-background, #f9f9f9);
      font-size: 12px;
      display: flex;
      align-items: baseline;
      gap: 6px;
      list-style: none;
    }
    .rec-item > summary::-webkit-details-marker { display: none; }
    .rec-resources { font-size: 11px; color: var(--vscode-descriptionForeground, #888); margin-left: auto; }
    .rec-desc { padding: 6px 10px; font-size: 11px; color: var(--vscode-descriptionForeground, #666); }
    .rec-actions { padding: 4px 10px 6px 24px; font-size: 11px; }
    .rec-actions li { margin: 2px 0; }
    .rec-link { display: inline-block; padding: 2px 10px 6px; font-size: 11px; color: var(--vscode-textLink-foreground, #007acc); }
    /* ── Logs panel ─────────────────────────────────────────────── */
    .logs-panel {
      display: none;
      max-height: 200px;
      overflow-y: auto;
      padding: 8px 16px;
      background: var(--vscode-terminal-background, #1e1e1e);
      border-top: 1px solid var(--vscode-panel-border, #333);
      font-family: 'Menlo', 'Courier New', monospace;
      font-size: 11px;
    }
    .logs-panel.visible { display: block; }
    .log-line {
      color: var(--vscode-terminal-foreground, #ccc);
      padding: 1px 0;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <span>📊 ADAC Diagram</span>
      <span class="badge badge-time">⏱ ${durationMs}ms</span>
    </div>
    <div class="toolbar-right">
      <button class="btn" id="toggle-logs" onclick="toggleLogs()">📋 Logs</button>
    </div>
  </div>

  <div class="diagram-container" id="diagram">
    ${svg}
  </div>

  ${optimizerHtml}

  <div class="logs-panel" id="logs-panel">
    ${logsHtml}
  </div>

  <script>
    function toggleLogs() {
      const panel = document.getElementById('logs-panel');
      panel.classList.toggle('visible');
    }
  </script>
</body>
</html>`;
}

export function getLoadingHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #d4d4d4);
      display: flex; align-items: center; justify-content: center;
      height: 100vh; margin: 0;
    }
    .loader { text-align: center; }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid var(--vscode-panel-border, #333);
      border-top: 3px solid var(--vscode-textLink-foreground, #569cd6);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Generating diagram with ELK layout engine...</p>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getErrorHtml(message: string, logs?: string[]): string {
  const logsHtml = logs
    ? `<div style="text-align:left;max-height:200px;overflow:auto;margin-top:16px;padding:8px;background:#1a1a1a;border-radius:6px;font-family:monospace;font-size:11px">${logs.map((l) => `<div>${escapeHtml(l)}</div>`).join('')}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #d4d4d4);
      display: flex; align-items: center; justify-content: center;
      height: 100vh; margin: 0;
    }
    .error { text-align: center; max-width: 600px; padding: 24px; }
    .error-icon { font-size: 48px; margin-bottom: 16px; }
    .error-msg { color: var(--vscode-errorForeground, #f48771); word-break: break-word; }
    .error-hint { font-size: 12px; color: var(--vscode-descriptionForeground, #888); margin-top: 8px; }
  </style>
</head>
<body>
  <div class="error">
    <div class="error-icon">⚠️</div>
    <p class="error-msg">${escapeHtml(message)}</p>
    <p class="error-hint">Fix the YAML errors and the preview will update automatically.</p>
    ${logsHtml}
  </div>
</body>
</html>`;
}
