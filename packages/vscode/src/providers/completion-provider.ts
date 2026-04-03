import * as vscode from 'vscode';
import {
  ALL_SERVICES,
  AWS_SERVICES,
  GCP_SERVICES,
  CONNECTION_TYPES,
  PROTOCOLS,
  APPLICATION_TYPES,
  ENVIRONMENTS,
  CLOUD_PROVIDERS,
  TIERS,
  COMPLIANCE_FRAMEWORKS,
  LAYOUT_ENGINES,
  AWS_REGIONS,
  GCP_REGIONS,
  PRICING_MODELS,
} from '../schema-data';

/**
 * CompletionProvider provides context-aware IntelliSense for ADAC YAML files.
 * It analyses the cursor position to determine what completions to offer.
 */
export class CompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): vscode.CompletionItem[] {
    void _token;
    void _context;
    const lineText = document.lineAt(position.line).text;
    const textBefore = lineText.substring(0, position.character);
    const context = this.analyzeContext(document, position);

    const items: vscode.CompletionItem[] = [];

    // Top-level keys
    if (context.depth === 0 && textBefore.trim() === '') {
      items.push(...this.createTopLevelCompletions());
    }

    // After "service:" or for service value
    if (context.parentKey === 'service' || /service:\s*$/.test(textBefore)) {
      const provider = this.detectProvider(document, position);
      const services =
        provider === 'gcp'
          ? GCP_SERVICES
          : provider === 'aws'
            ? AWS_SERVICES
            : ALL_SERVICES;
      for (const [key, info] of Object.entries(services)) {
        const item = new vscode.CompletionItem(
          key,
          vscode.CompletionItemKind.EnumMember
        );
        item.detail = `${info.name} (${info.category})`;
        item.documentation = new vscode.MarkdownString(
          `**${info.name}**\n\n${info.description}\n\n*Category:* ${info.category}\n\n*Provider:* ${info.provider.toUpperCase()}`
        );
        item.insertText = key;
        items.push(item);
      }
    }

    // Connection type
    if (context.parentKey === 'type' && context.inConnections) {
      for (const type of CONNECTION_TYPES) {
        const item = new vscode.CompletionItem(
          type,
          vscode.CompletionItemKind.EnumMember
        );
        item.detail = 'Connection type';
        items.push(item);
      }
    }

    // Application type
    if (context.parentKey === 'type' && context.inApplications) {
      for (const type of APPLICATION_TYPES) {
        const item = new vscode.CompletionItem(
          type,
          vscode.CompletionItemKind.EnumMember
        );
        item.detail = 'Application type';
        items.push(item);
      }
    }

    // Protocol
    if (context.parentKey === 'protocol' || /protocol:\s*$/.test(textBefore)) {
      for (const proto of PROTOCOLS) {
        const item = new vscode.CompletionItem(
          proto,
          vscode.CompletionItemKind.EnumMember
        );
        item.detail = 'Protocol';
        items.push(item);
      }
    }

    // Provider
    if (context.parentKey === 'provider' || /provider:\s*$/.test(textBefore)) {
      for (const p of CLOUD_PROVIDERS) {
        const item = new vscode.CompletionItem(
          p,
          vscode.CompletionItemKind.EnumMember
        );
        item.detail = 'Cloud provider';
        items.push(item);
      }
    }

    // Region
    if (context.parentKey === 'region' || /region:\s*$/.test(textBefore)) {
      const provider = this.detectProvider(document, position);
      const regions = provider === 'gcp' ? GCP_REGIONS : AWS_REGIONS;
      for (const region of regions) {
        const item = new vscode.CompletionItem(
          region,
          vscode.CompletionItemKind.EnumMember
        );
        item.detail = `${provider?.toUpperCase() || 'Cloud'} region`;
        items.push(item);
      }
    }

    // Environment
    if (
      context.parentKey === 'environment' ||
      /environment:\s*$/.test(textBefore)
    ) {
      for (const env of ENVIRONMENTS) {
        const item = new vscode.CompletionItem(
          env,
          vscode.CompletionItemKind.EnumMember
        );
        item.detail = 'Environment';
        items.push(item);
      }
    }

    // Tier
    if (context.parentKey === 'tier' || /tier:\s*$/.test(textBefore)) {
      for (const tier of TIERS) {
        const item = new vscode.CompletionItem(
          tier,
          vscode.CompletionItemKind.EnumMember
        );
        item.detail = 'Infrastructure tier';
        items.push(item);
      }
    }

    // Compliance
    if (
      context.inCompliance ||
      /compliance:\s*$/.test(textBefore) ||
      (/^\s*-\s*$/.test(textBefore) && context.inCompliance)
    ) {
      for (const fw of COMPLIANCE_FRAMEWORKS) {
        const item = new vscode.CompletionItem(
          fw,
          vscode.CompletionItemKind.EnumMember
        );
        item.detail = 'Compliance framework';
        items.push(item);
      }
    }

    // Layout
    if (context.parentKey === 'layout' || /layout:\s*$/.test(textBefore)) {
      for (const engine of LAYOUT_ENGINES) {
        const item = new vscode.CompletionItem(
          engine,
          vscode.CompletionItemKind.EnumMember
        );
        item.detail = 'Layout engine';
        items.push(item);
      }
    }

    // Pricing model
    if (
      context.parentKey === 'pricing_model' ||
      /pricing_model:\s*$/.test(textBefore)
    ) {
      for (const model of PRICING_MODELS) {
        const item = new vscode.CompletionItem(
          model,
          vscode.CompletionItemKind.EnumMember
        );
        item.detail = 'Pricing model';
        items.push(item);
      }
    }

    // ID references for "from" and "to" in connections
    if (
      (context.parentKey === 'from' || context.parentKey === 'to') &&
      context.inConnections
    ) {
      const ids = this.collectAllIds(document);
      for (const id of ids) {
        const item = new vscode.CompletionItem(
          id,
          vscode.CompletionItemKind.Reference
        );
        item.detail = 'Service/Application ID';
        items.push(item);
      }
    }

    // ID references for "runs" array items
    if (context.parentKey === 'runs' || context.inRuns) {
      const appIds = this.collectApplicationIds(document);
      for (const id of appIds) {
        const item = new vscode.CompletionItem(
          id,
          vscode.CompletionItemKind.Reference
        );
        item.detail = 'Application ID';
        items.push(item);
      }
    }

    // Service-level keys
    if (context.inService && /^\s+$/.test(textBefore)) {
      const serviceKeys = [
        'id',
        'service',
        'name',
        'description',
        'type',
        'subtype',
        'runs',
        'configuration',
        'config',
        'cost',
        'monitoring',
        'compliance',
        'tags',
        'availability_zones',
        'security_groups',
        'subnets',
        'iam_role',
        'visual',
      ];
      for (const key of serviceKeys) {
        const item = new vscode.CompletionItem(
          key,
          vscode.CompletionItemKind.Property
        );
        item.detail = 'Service property';
        item.insertText = `${key}: `;
        items.push(item);
      }
    }

    return items;
  }

  private createTopLevelCompletions(): vscode.CompletionItem[] {
    const keys = [
      {
        key: 'version',
        detail: 'ADAC specification version',
        snippet: "version: '0.1'",
      },
      {
        key: 'metadata',
        detail: 'Architecture metadata',
        snippet: 'metadata:\n  name: ',
      },
      {
        key: 'applications',
        detail: 'Logical applications',
        snippet: 'applications:\n  - id: ',
      },
      {
        key: 'infrastructure',
        detail: 'Cloud infrastructure',
        snippet: 'infrastructure:\n  clouds:\n    - id: ',
      },
      {
        key: 'connections',
        detail: 'Service connections',
        snippet: 'connections:\n  - id: ',
      },
      {
        key: 'cost',
        detail: 'Cost summary',
        snippet: 'cost:\n  total_monthly: ',
      },
      { key: 'layout', detail: 'Layout engine', snippet: 'layout: elk' },
    ];

    return keys.map(({ key, detail, snippet }) => {
      const item = new vscode.CompletionItem(
        key,
        vscode.CompletionItemKind.Keyword
      );
      item.detail = detail;
      item.insertText = new vscode.SnippetString(snippet);
      return item;
    });
  }

  private analyzeContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): {
    depth: number;
    parentKey: string | null;
    inConnections: boolean;
    inApplications: boolean;
    inService: boolean;
    inCompliance: boolean;
    inRuns: boolean;
  } {
    const lineText = document.lineAt(position.line).text;
    const indent = lineText.search(/\S/);
    const depth = indent >= 0 ? Math.floor(indent / 2) : 0;

    // Extract key from current line
    const keyMatch = lineText.match(/^\s*(\w[\w-]*):\s*/);
    const parentKey = keyMatch ? keyMatch[1] : null;

    // Look backward to determine context
    let inConnections = false;
    let inApplications = false;
    let inService = false;
    let inCompliance = false;
    let inRuns = false;

    for (let i = position.line; i >= 0; i--) {
      const line = document.lineAt(i).text;
      const lineIndent = line.search(/\S/);

      if (lineIndent === 0) {
        if (line.startsWith('connections:')) inConnections = true;
        if (line.startsWith('applications:')) inApplications = true;
        break;
      }

      if (/^\s+services:/.test(line) && lineIndent < indent) {
        inService = true;
      }

      if (/^\s+compliance:/.test(line) && lineIndent < indent) {
        inCompliance = true;
      }

      if (/^\s+runs:/.test(line) && lineIndent < indent) {
        inRuns = true;
      }
    }

    return {
      depth,
      parentKey,
      inConnections,
      inApplications,
      inService,
      inCompliance,
      inRuns,
    };
  }

  private detectProvider(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string | null {
    for (let i = position.line; i >= 0; i--) {
      const lineText = document.lineAt(i).text;
      const match = lineText.match(/provider:\s*['"]?(\w+)['"]?/);
      if (match) {
        return match[1];
      }
    }
    const text = document.getText();
    const providerMatch = text.match(/provider:\s*['"]?(\w+)['"]?/);
    return providerMatch ? providerMatch[1] : null;
  }

  private collectAllIds(document: vscode.TextDocument): string[] {
    const ids: string[] = [];
    const text = document.getText();
    const regex = /^\s+(?:-\s+)?id:\s*['"]?([a-z0-9-_]+)['"]?/gm;
    let match;
    while ((match = regex.exec(text)) !== null) {
      ids.push(match[1]);
    }
    return ids;
  }

  private collectApplicationIds(document: vscode.TextDocument): string[] {
    const ids: string[] = [];
    const text = document.getText();
    const lines = text.split('\n');
    let inApps = false;

    for (const line of lines) {
      if (/^applications:/.test(line)) {
        inApps = true;
        continue;
      }
      if (/^[a-z]/.test(line) && inApps) {
        inApps = false;
        continue;
      }
      if (inApps) {
        const idMatch = line.match(
          /^\s+(?:-\s+)?id:\s*['"]?([a-z0-9-_]+)['"]?/
        );
        if (idMatch) {
          ids.push(idMatch[1]);
        }
      }
    }
    return ids;
  }
}
