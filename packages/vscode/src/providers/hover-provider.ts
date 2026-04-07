import * as vscode from 'vscode';
import {
  ALL_SERVICES,
  CONNECTION_TYPES,
  COMPLIANCE_FRAMEWORKS,
} from '../schema-data';

/**
 * HoverProvider provides rich hover tooltips for ADAC YAML files.
 * Shows service descriptions, connection type info, and compliance details.
 */
export class HoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.Hover | null {
    void _token;
    const line = document.lineAt(position.line).text;
    const wordRange = document.getWordRangeAtPosition(position, /[a-z0-9_-]+/i);
    if (!wordRange) return null;

    const word = document.getText(wordRange);

    // Check if hovering over a service type value
    if (this.isServiceContext(line)) {
      const info = ALL_SERVICES[word];
      if (info) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`### ${info.name}\n\n`);
        md.appendMarkdown(`${info.description}\n\n`);
        md.appendMarkdown(`| Property | Value |\n|---|---|\n`);
        md.appendMarkdown(
          `| **Provider** | ${info.provider.toUpperCase()} |\n`
        );
        md.appendMarkdown(`| **Category** | ${info.category} |\n`);
        md.isTrusted = true;
        return new vscode.Hover(md, wordRange);
      }
    }

    // Check if hovering over a connection type
    if (this.isConnectionTypeContext(line)) {
      if (CONNECTION_TYPES.includes(word)) {
        const descriptions: Record<string, string> = {
          'api-call': 'HTTP/gRPC API call between services',
          'database-query': 'SQL or NoSQL database query',
          'cache-read': 'Read from a cache layer (Redis, Memcached)',
          'cache-write': 'Write to a cache layer',
          'message-publish': 'Publish message to a queue or topic',
          'message-consume': 'Consume messages from a queue or topic',
          'file-upload': 'Upload a file to storage',
          'file-download': 'Download a file from storage',
          'stream-read': 'Read from a data stream',
          'stream-write': 'Write to a data stream',
          replication: 'Data replication between instances',
          backup: 'Backup data to storage',
          failover: 'Failover connection for high availability',
          'cdn-origin': 'CDN fetching content from its origin',
          'dns-resolution': 'DNS query and resolution',
          'load-balancing': 'Load balancer distributing traffic',
          authentication: 'Authentication request',
          authorization: 'Authorization/permission check',
          database: 'Generic database connection',
        };

        const md = new vscode.MarkdownString();
        md.appendMarkdown(`### Connection: \`${word}\`\n\n`);
        md.appendMarkdown(
          descriptions[word] || 'Connection type for service communication'
        );
        return new vscode.Hover(md, wordRange);
      }
    }

    // Check if hovering over a compliance framework
    if (this.isComplianceContext(line)) {
      const descriptions: Record<string, string> = {
        'pci-dss':
          '**PCI-DSS** - Payment Card Industry Data Security Standard. Required for services processing credit card data.',
        hipaa:
          '**HIPAA** - Health Insurance Portability and Accountability Act. Required for services handling protected health information (PHI).',
        gdpr: '**GDPR** - General Data Protection Regulation. Required for services processing EU citizen personal data.',
        soc2: '**SOC 2** - Service Organization Control 2. Trust service criteria for security, availability, processing integrity, confidentiality, and privacy.',
        iso27001:
          '**ISO 27001** - Information security management system standard.',
        fedramp:
          '**FedRAMP** - Federal Risk and Authorization Management Program. Required for cloud services used by US federal agencies.',
      };

      if (COMPLIANCE_FRAMEWORKS.includes(word) && descriptions[word]) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(descriptions[word]);
        return new vscode.Hover(md, wordRange);
      }
    }

    // Check if hovering over an ADAC top-level key
    const topLevelDescriptions: Record<string, string> = {
      version: '**ADAC Version** - Specification version (e.g., `0.1`)',
      metadata:
        '**Metadata** - Architecture name, author, description, dates, and tags',
      applications:
        '**Applications** - Logical applications and services that run on the infrastructure',
      infrastructure:
        '**Infrastructure** - Cloud provider configurations and service definitions',
      connections:
        '**Connections** - Relationships between applications and services with protocol and type info',
      cost: '**Cost Summary** - Overall architecture cost estimation',
      layout:
        '**Layout Engine** - Diagram layout engine selection (`elk` or `dagre`)',
    };

    const keyMatch = line.match(/^(\w+)\s*:/);
    if (keyMatch && keyMatch[1] === word && topLevelDescriptions[word]) {
      const md = new vscode.MarkdownString();
      md.appendMarkdown(topLevelDescriptions[word]);
      return new vscode.Hover(md, wordRange);
    }

    // Hover over IDs - show what references them
    if (this.isIdContext(line)) {
      const refs = this.findReferences(document, word);
      if (refs.length > 0) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`### ID: \`${word}\`\n\n`);
        md.appendMarkdown(`**Referenced by:**\n\n`);
        for (const ref of refs) {
          md.appendMarkdown(
            `- Line ${ref.line + 1}: \`${ref.context.trim()}\`\n`
          );
        }
        return new vscode.Hover(md, wordRange);
      }
    }

    return null;
  }

  private isServiceContext(line: string): boolean {
    return /service:\s*/.test(line) || /subtype:\s*/.test(line);
  }

  private isConnectionTypeContext(line: string): boolean {
    return /type:\s*/.test(line);
  }

  private isComplianceContext(line: string): boolean {
    return /compliance:/.test(line) || /^\s*-\s*[a-z]/.test(line);
  }

  private isIdContext(line: string): boolean {
    return /id:\s*/.test(line);
  }

  private findReferences(
    document: vscode.TextDocument,
    id: string
  ): { line: number; context: string }[] {
    const refs: { line: number; context: string }[] = [];
    const lines = document.getText().split('\n');
    const escaped = id.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
    const regex = new RegExp(
      `(from|to|runs).*['"]?(?<![a-z0-9-])${escaped}(?![a-z0-9-])['"]?`,
      'i'
    );

    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        refs.push({ line: i, context: lines[i] });
      }
    }

    return refs;
  }
}
