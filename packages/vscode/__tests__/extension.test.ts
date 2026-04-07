/* eslint-disable */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── VS Code Mock ────────────────────────────────────────────────────────────
vi.mock('vscode', () => {
  const DiagnosticSeverity = {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3,
  };

  class MockRange {
    start: { line: number; character: number };
    end: { line: number; character: number };
    constructor(
      startLine: number,
      startChar: number,
      endLine: number,
      endChar: number
    ) {
      this.start = { line: startLine, character: startChar };
      this.end = { line: endLine, character: endChar };
    }
  }

  class MockDiagnostic {
    range: MockRange;
    message: string;
    severity: number;
    constructor(range: MockRange, message: string, severity: number) {
      this.range = range;
      this.message = message;
      this.severity = severity;
    }
  }

  class MockPosition {
    line: number;
    character: number;
    constructor(line: number, character: number) {
      this.line = line;
      this.character = character;
    }
  }

  return {
    languages: {
      createDiagnosticCollection: vi.fn(() => ({
        set: vi.fn(),
        delete: vi.fn(),
        dispose: vi.fn(),
      })),
      registerCompletionItemProvider: vi.fn(),
      registerHoverProvider: vi.fn(),
    },
    workspace: {
      onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
      onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
      onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
      onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
      textDocuments: [],
      workspaceFolders: [],
      getConfiguration: vi.fn(() => ({
        get: vi.fn((_key: string, defaultValue: any) => defaultValue),
      })),
    },
    window: {
      activeTextEditor: null,
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      showErrorMessage: vi.fn(),
      createStatusBarItem: vi.fn(() => ({
        show: vi.fn(),
        hide: vi.fn(),
        dispose: vi.fn(),
        text: '',
        tooltip: '',
        command: '',
      })),
      createWebviewPanel: vi.fn(),
      onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
    },
    commands: {
      registerCommand: vi.fn(),
    },
    Range: MockRange,
    Position: MockPosition,
    Diagnostic: MockDiagnostic,
    DiagnosticSeverity,
    CompletionItem: class {
      label: string;
      kind: number;
      detail?: string;
      documentation?: any;
      insertText?: any;
      constructor(label: string, kind: number) {
        this.label = label;
        this.kind = kind;
      }
    },
    CompletionItemKind: {
      Keyword: 14,
      EnumMember: 20,
      Property: 10,
      Reference: 18,
    },
    Hover: class {
      contents: any;
      range: any;
      constructor(contents: any, range?: any) {
        this.contents = contents;
        this.range = range;
      }
    },
    MarkdownString: class {
      value: string;
      isTrusted: boolean;
      constructor(value?: string) {
        this.value = value || '';
        this.isTrusted = false;
      }
      appendMarkdown(text: string) {
        this.value += text;
        return this;
      }
    },
    SnippetString: class {
      value: string;
      constructor(value: string) {
        this.value = value;
      }
    },
    StatusBarAlignment: { Left: 1, Right: 2 },
    ViewColumn: { Active: -1, Beside: -2, One: 1 },
    DocumentSelector: {},
    CancellationTokenSource: class {
      token = { isCancellationRequested: false };
    },
  };
});

// ─── Test Helpers ─────────────────────────────────────────────────────────────

/** Create a mock TextDocument from YAML content */
function createMockDocument(content: string, fileName = 'test.adac.yaml') {
  const lines = content.split('\n');
  return {
    getText: () => content,
    uri: { toString: () => fileName, fsPath: fileName },
    fileName,
    languageId: 'adac-yaml',
    lineCount: lines.length,
    lineAt: (line: number) => ({
      text: lines[line] || '',
      range: {
        start: { line, character: 0 },
        end: { line, character: (lines[line] || '').length },
      },
      firstNonWhitespaceCharacterIndex: (lines[line] || '').search(/\S/),
    }),
    positionAt: (offset: number) => {
      let pos = 0;
      for (let i = 0; i < lines.length; i++) {
        if (pos + lines[i].length + 1 > offset) {
          return { line: i, character: offset - pos };
        }
        pos += lines[i].length + 1;
      }
      return { line: 0, character: 0 };
    },
    offsetAt: (position: { line: number; character: number }) => {
      let offset = 0;
      for (let i = 0; i < position.line && i < lines.length; i++) {
        offset += lines[i].length + 1;
      }
      return offset + position.character;
    },
    getWordRangeAtPosition: (
      position: { line: number; character: number },
      _regexp?: RegExp
    ) => {
      const line = lines[position.line] || '';
      const wordRegex = /[a-zA-Z0-9_-]+/g;
      let match;
      while ((match = wordRegex.exec(line)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (position.character >= start && position.character <= end) {
          return {
            start: { line: position.line, character: start },
            end: { line: position.line, character: end },
          };
        }
      }
      return undefined;
    },
  };
}

function createMockPosition(line: number, character: number) {
  return { line, character };
}

const mockToken = { isCancellationRequested: false };
const mockContext = { triggerKind: 0, triggerCharacter: undefined };

// ─── Schema Data ──────────────────────────────────────────────────────────────

describe('Schema Data', () => {
  it('should export AWS services with correct structure', async () => {
    const { AWS_SERVICES } = await import('../src/schema-data');
    expect(Object.keys(AWS_SERVICES).length).toBeGreaterThan(60);

    // Spot check several categories
    expect(AWS_SERVICES['ec2']).toEqual({
      name: 'Amazon EC2',
      description: 'Elastic Compute Cloud - Scalable virtual servers',
      category: 'Compute',
      provider: 'aws',
    });
    expect(AWS_SERVICES['lambda'].category).toBe('Compute');
    expect(AWS_SERVICES['rds-postgres'].category).toBe('Database');
    expect(AWS_SERVICES['s3'].category).toBe('Storage');
    expect(AWS_SERVICES['alb'].category).toBe('Networking');
    expect(AWS_SERVICES['sqs'].category).toBe('Messaging');
    expect(AWS_SERVICES['cloudwatch'].category).toBe('Monitoring');
    expect(AWS_SERVICES['iam'].category).toBe('Security');
    expect(AWS_SERVICES['sagemaker'].category).toBe('AI/ML');
    expect(AWS_SERVICES['glue'].category).toBe('Analytics');
    expect(AWS_SERVICES['codepipeline'].category).toBe('Developer Tools');
  });

  it('should export GCP services with correct structure', async () => {
    const { GCP_SERVICES } = await import('../src/schema-data');
    expect(Object.keys(GCP_SERVICES).length).toBeGreaterThan(15);

    expect(GCP_SERVICES['cloud-run']).toEqual({
      name: 'Cloud Run',
      description: 'Serverless container platform',
      category: 'Compute',
      provider: 'gcp',
    });
    expect(GCP_SERVICES['bigquery'].category).toBe('Analytics');
    expect(GCP_SERVICES['cloud-storage'].category).toBe('Storage');
    expect(GCP_SERVICES['pub-sub'].category).toBe('Messaging');
    expect(GCP_SERVICES['vertex-ai'].category).toBe('AI/ML');
  });

  it('should have ALL_SERVICES as a superset of AWS + GCP', async () => {
    const { ALL_SERVICES, AWS_SERVICES, GCP_SERVICES } =
      await import('../src/schema-data');
    const totalExpected =
      Object.keys(AWS_SERVICES).length + Object.keys(GCP_SERVICES).length;
    expect(Object.keys(ALL_SERVICES).length).toBe(totalExpected);
  });

  it('should have all connection types', async () => {
    const { CONNECTION_TYPES } = await import('../src/schema-data');
    const expected = [
      'api-call',
      'database-query',
      'cache-read',
      'cache-write',
      'message-publish',
      'message-consume',
      'file-upload',
      'file-download',
      'stream-read',
      'stream-write',
      'replication',
      'backup',
      'failover',
      'load-balancing',
      'authentication',
      'authorization',
      'database',
    ];
    for (const t of expected) {
      expect(CONNECTION_TYPES).toContain(t);
    }
  });

  it('should have all protocols', async () => {
    const { PROTOCOLS } = await import('../src/schema-data');
    expect(PROTOCOLS).toContain('HTTPS');
    expect(PROTOCOLS).toContain('gRPC');
    expect(PROTOCOLS).toContain('WebSocket');
    expect(PROTOCOLS).toContain('PostgreSQL');
    expect(PROTOCOLS).toContain('Redis');
    expect(PROTOCOLS).toContain('MQTT');
  });

  it('should have application types', async () => {
    const { APPLICATION_TYPES } = await import('../src/schema-data');
    expect(APPLICATION_TYPES).toContain('frontend');
    expect(APPLICATION_TYPES).toContain('backend');
    expect(APPLICATION_TYPES).toContain('api');
    expect(APPLICATION_TYPES).toContain('microservice');
    expect(APPLICATION_TYPES).toContain('worker');
    expect(APPLICATION_TYPES).toContain('batch-job');
  });

  it('should have all compliance frameworks', async () => {
    const { COMPLIANCE_FRAMEWORKS } = await import('../src/schema-data');
    expect(COMPLIANCE_FRAMEWORKS).toEqual(
      expect.arrayContaining([
        'pci-dss',
        'hipaa',
        'gdpr',
        'soc2',
        'iso27001',
        'fedramp',
      ])
    );
  });

  it('should have cloud providers', async () => {
    const { CLOUD_PROVIDERS } = await import('../src/schema-data');
    expect(CLOUD_PROVIDERS).toEqual(
      expect.arrayContaining(['aws', 'gcp', 'azure', 'kubernetes'])
    );
  });

  it('should have AWS regions', async () => {
    const { AWS_REGIONS } = await import('../src/schema-data');
    expect(AWS_REGIONS).toContain('us-east-1');
    expect(AWS_REGIONS).toContain('eu-west-1');
    expect(AWS_REGIONS).toContain('ap-southeast-1');
  });

  it('should have GCP regions', async () => {
    const { GCP_REGIONS } = await import('../src/schema-data');
    expect(GCP_REGIONS).toContain('us-central1');
    expect(GCP_REGIONS).toContain('europe-west1');
    expect(GCP_REGIONS).toContain('asia-east1');
  });

  it('should have pricing models', async () => {
    const { PRICING_MODELS } = await import('../src/schema-data');
    expect(PRICING_MODELS).toEqual(
      expect.arrayContaining([
        'on-demand',
        'reserved-1yr',
        'reserved-3yr',
        'spot',
        'savings-plan',
      ])
    );
  });

  it('should have tiers', async () => {
    const { TIERS } = await import('../src/schema-data');
    expect(TIERS).toEqual(
      expect.arrayContaining([
        'primary',
        'secondary',
        'failover',
        'development',
        'test',
      ])
    );
  });

  it('should have environments', async () => {
    const { ENVIRONMENTS } = await import('../src/schema-data');
    expect(ENVIRONMENTS).toEqual(
      expect.arrayContaining([
        'development',
        'staging',
        'production',
        'test',
        'demo',
      ])
    );
  });

  it('should have layout engines', async () => {
    const { LAYOUT_ENGINES } = await import('../src/schema-data');
    expect(LAYOUT_ENGINES).toEqual(['elk', 'dagre']);
  });

  it('should have every AWS service with all required fields', async () => {
    const { AWS_SERVICES } = await import('../src/schema-data');
    for (const [key, info] of Object.entries(AWS_SERVICES)) {
      expect(info.name, `${key} missing name`).toBeTruthy();
      expect(info.description, `${key} missing description`).toBeTruthy();
      expect(info.category, `${key} missing category`).toBeTruthy();
      expect(info.provider, `${key} wrong provider`).toBe('aws');
    }
  });

  it('should have every GCP service with all required fields', async () => {
    const { GCP_SERVICES } = await import('../src/schema-data');
    for (const [key, info] of Object.entries(GCP_SERVICES)) {
      expect(info.name, `${key} missing name`).toBeTruthy();
      expect(info.description, `${key} missing description`).toBeTruthy();
      expect(info.category, `${key} missing category`).toBeTruthy();
      expect(info.provider, `${key} wrong provider`).toBe('gcp');
    }
  });
});

// ─── DiagnosticProvider ───────────────────────────────────────────────────────

describe('DiagnosticProvider', () => {
  let DiagnosticProvider: any;
  let provider: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../src/providers/diagnostic-provider');
    DiagnosticProvider = mod.DiagnosticProvider;
    provider = new DiagnosticProvider();
  });

  it('should instantiate without errors', () => {
    expect(provider).toBeDefined();
    expect(provider.validateDocument).toBeInstanceOf(Function);
    expect(provider.dispose).toBeInstanceOf(Function);
  });

  it('should pass a fully valid ADAC document with zero errors', () => {
    const doc = createMockDocument(`version: '0.1'
metadata:
  name: 'My Arch'
  author: 'Author'
  created: '2026-01-01'
infrastructure:
  clouds:
    - id: 'aws-1'
      provider: aws
      region: us-east-1
      services:
        - id: 'svc-1'
          service: ec2
applications:
  - id: 'app-1'
    name: 'Frontend'
    type: frontend
connections:
  - id: 'conn-1'
    from: 'app-1'
    to: 'svc-1'
    type: api-call`);

    const diagnostics = provider.validateDocument(doc);
    const errors = diagnostics.filter((d: any) => d.severity === 0);
    expect(errors.length).toBe(0);
  });

  it('should report missing "version" field', () => {
    const doc = createMockDocument(`metadata:
  name: 'Test'
infrastructure:
  clouds:
    - id: 'c1'
      provider: aws
      region: us-east-1`);

    const diagnostics = provider.validateDocument(doc);
    const msgs = diagnostics.map((d: any) => d.message);
    expect(msgs.some((m: string) => m.includes('version'))).toBe(true);
  });

  it('should report missing "metadata" field', () => {
    const doc = createMockDocument(`version: '0.1'
infrastructure:
  clouds:
    - id: 'c1'
      provider: aws
      region: us-east-1`);

    const diagnostics = provider.validateDocument(doc);
    const msgs = diagnostics.map((d: any) => d.message);
    expect(msgs.some((m: string) => m.includes('metadata'))).toBe(true);
  });

  it('should report missing "infrastructure" field', () => {
    const doc = createMockDocument(`version: '0.1'
metadata:
  name: 'Test'`);

    const diagnostics = provider.validateDocument(doc);
    const msgs = diagnostics.map((d: any) => d.message);
    expect(msgs.some((m: string) => m.includes('infrastructure'))).toBe(true);
  });

  it('should report missing metadata.name', () => {
    const doc = createMockDocument(`version: '0.1'
metadata:
  author: 'Someone'
infrastructure:
  clouds:
    - id: 'c1'
      provider: aws
      region: us-east-1`);

    const diagnostics = provider.validateDocument(doc);
    const msgs = diagnostics.map((d: any) => d.message);
    expect(
      msgs.some((m: string) => m.includes('metadata') && m.includes('name'))
    ).toBe(true);
  });

  it('should warn about missing metadata.created', () => {
    const doc = createMockDocument(`version: '0.1'
metadata:
  name: 'Test'
infrastructure:
  clouds:
    - id: 'c1'
      provider: aws
      region: us-east-1`);

    const diagnostics = provider.validateDocument(doc);
    const warnings = diagnostics.filter((d: any) => d.severity === 1);
    const msgs = warnings.map((d: any) => d.message);
    expect(msgs.some((m: string) => m.includes('created'))).toBe(true);
  });

  it('should report missing infrastructure.clouds', () => {
    const doc = createMockDocument(`version: '0.1'
metadata:
  name: 'Test'
  created: '2026-01-01'
infrastructure:
  something: true`);

    const diagnostics = provider.validateDocument(doc);
    const msgs = diagnostics.map((d: any) => d.message);
    expect(msgs.some((m: string) => m.includes('clouds'))).toBe(true);
  });

  it('should report missing cloud.provider', () => {
    const doc = createMockDocument(`version: '0.1'
metadata:
  name: 'Test'
  created: '2026-01-01'
infrastructure:
  clouds:
    - id: 'c1'
      region: us-east-1`);

    const diagnostics = provider.validateDocument(doc);
    const msgs = diagnostics.map((d: any) => d.message);
    expect(msgs.some((m: string) => m.includes('provider'))).toBe(true);
  });

  it('should report missing cloud.region', () => {
    const doc = createMockDocument(`version: '0.1'
metadata:
  name: 'Test'
  created: '2026-01-01'
infrastructure:
  clouds:
    - id: 'c1'
      provider: aws`);

    const diagnostics = provider.validateDocument(doc);
    const msgs = diagnostics.map((d: any) => d.message);
    expect(msgs.some((m: string) => m.includes('region'))).toBe(true);
  });

  it('should detect duplicate IDs', () => {
    const doc = createMockDocument(`version: '0.1'
metadata:
  name: 'Test'
  created: '2026-01-01'
infrastructure:
  clouds:
    - id: 'cloud-1'
      provider: aws
      region: us-east-1
      services:
        - id: 'svc-dup'
          service: ec2
        - id: 'svc-dup'
          service: s3`);

    const diagnostics = provider.validateDocument(doc);
    const msgs = diagnostics.map((d: any) => d.message);
    expect(
      msgs.some(
        (m: string) => m.includes('Duplicate ID') && m.includes('svc-dup')
      )
    ).toBe(true);
  });

  it('should warn about unknown connection references', () => {
    const doc = createMockDocument(`version: '0.1'
metadata:
  name: 'Test'
  created: '2026-01-01'
infrastructure:
  clouds:
    - id: 'c1'
      provider: aws
      region: us-east-1
      services:
        - id: 'svc-1'
          service: ec2
connections:
  - id: 'conn-1'
    from: 'nonexistent-app'
    to: 'svc-1'
    type: api-call`);

    const diagnostics = provider.validateDocument(doc);
    const msgs = diagnostics.map((d: any) => d.message);
    expect(msgs.some((m: string) => m.includes('nonexistent-app'))).toBe(true);
  });

  it('should detect YAML syntax errors', () => {
    const doc = createMockDocument(`version: '0.1'
  bad indentation: [`);

    const diagnostics = provider.validateDocument(doc);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0].severity).toBe(0); // Error
    expect(diagnostics[0].message).toContain('YAML');
  });

  it('should handle empty document', () => {
    const doc = createMockDocument('');
    const diagnostics = provider.validateDocument(doc);
    // Empty YAML is null/undefined, so structural validation is skipped
    // but missing fields aren't reported since nothing parsed
    expect(diagnostics).toBeDefined();
  });

  it('should handle document with only comments', () => {
    const doc = createMockDocument('# This is a comment\n# Another comment');
    const diagnostics = provider.validateDocument(doc);
    expect(diagnostics).toBeDefined();
  });

  it('should clean up on dispose', () => {
    expect(() => provider.dispose()).not.toThrow();
  });
});

// ─── CompletionProvider ───────────────────────────────────────────────────────

describe('CompletionProvider', () => {
  let CompletionProvider: any;
  let provider: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../src/providers/completion-provider');
    CompletionProvider = mod.CompletionProvider;
    provider = new CompletionProvider();
  });

  it('should instantiate without errors', () => {
    expect(provider).toBeDefined();
    expect(provider.provideCompletionItems).toBeInstanceOf(Function);
  });

  it('should provide top-level key completions at root indent', () => {
    const doc = createMockDocument('');
    const position = createMockPosition(0, 0);
    const items = provider.provideCompletionItems(
      doc,
      position,
      mockToken,
      mockContext
    );
    const labels = items.map((i: any) => i.label);
    expect(labels).toContain('version');
    expect(labels).toContain('metadata');
    expect(labels).toContain('applications');
    expect(labels).toContain('infrastructure');
    expect(labels).toContain('connections');
    expect(labels).toContain('layout');
  });

  it('should provide service completions after "service:" key', () => {
    const content = `infrastructure:
  clouds:
    - id: cloud-1
      provider: aws
      region: us-east-1
      services:
        - id: svc-1
          service: `;
    const doc = createMockDocument(content);
    const position = createMockPosition(7, 19);

    const items = provider.provideCompletionItems(
      doc,
      position,
      mockToken,
      mockContext
    );
    const labels = items.map((i: any) => i.label);
    expect(labels).toContain('ec2');
    expect(labels).toContain('lambda');
    expect(labels).toContain('s3');
    expect(labels).toContain('rds-postgres');
  });

  it('should provide protocol completions after "protocol:" key', () => {
    const content = `connections:
  - id: conn-1
    protocol: `;
    const doc = createMockDocument(content);
    const position = createMockPosition(2, 14);

    const items = provider.provideCompletionItems(
      doc,
      position,
      mockToken,
      mockContext
    );
    const labels = items.map((i: any) => i.label);
    expect(labels).toContain('HTTPS');
    expect(labels).toContain('gRPC');
    expect(labels).toContain('WebSocket');
  });

  it('should provide provider completions after "provider:" key', () => {
    const content = `infrastructure:
  clouds:
    - id: c1
      provider: `;
    const doc = createMockDocument(content);
    const position = createMockPosition(3, 16);

    const items = provider.provideCompletionItems(
      doc,
      position,
      mockToken,
      mockContext
    );
    const labels = items.map((i: any) => i.label);
    expect(labels).toContain('aws');
    expect(labels).toContain('gcp');
    expect(labels).toContain('azure');
  });

  it('should provide environment completions after "environment:" key', () => {
    const content = `metadata:
  environment: `;
    const doc = createMockDocument(content);
    const position = createMockPosition(1, 16);

    const items = provider.provideCompletionItems(
      doc,
      position,
      mockToken,
      mockContext
    );
    const labels = items.map((i: any) => i.label);
    expect(labels).toContain('development');
    expect(labels).toContain('production');
    expect(labels).toContain('staging');
  });

  it('should provide region completions after "region:" key', () => {
    const content = `infrastructure:
  clouds:
    - id: c1
      provider: aws
      region: `;
    const doc = createMockDocument(content);
    const position = createMockPosition(4, 13);

    const items = provider.provideCompletionItems(
      doc,
      position,
      mockToken,
      mockContext
    );
    const labels = items.map((i: any) => i.label);
    expect(labels).toContain('us-east-1');
  });

  it('should provide ID references for connection "from" field', () => {
    const content = `applications:
  - id: my-app
    name: App
infrastructure:
  clouds:
    - id: c1
      provider: aws
      region: us-east-1
      services:
        - id: my-svc
          service: ec2
connections:
  - id: conn-1
    from: `;
    const doc = createMockDocument(content);
    const position = createMockPosition(13, 10);

    const items = provider.provideCompletionItems(
      doc,
      position,
      mockToken,
      mockContext
    );
    const labels = items.map((i: any) => i.label);
    expect(labels).toContain('my-app');
    expect(labels).toContain('my-svc');
  });

  it('should provide tier completions after "tier:" key', () => {
    const content = `infrastructure:
  clouds:
    - id: c1
      tier: `;
    const doc = createMockDocument(content);
    const position = createMockPosition(3, 11);

    const items = provider.provideCompletionItems(
      doc,
      position,
      mockToken,
      mockContext
    );
    const labels = items.map((i: any) => i.label);
    expect(labels).toContain('primary');
    expect(labels).toContain('secondary');
  });

  it('should provide layout engine completions', () => {
    const content = `layout: `;
    const doc = createMockDocument(content);
    const position = createMockPosition(0, 8);

    const items = provider.provideCompletionItems(
      doc,
      position,
      mockToken,
      mockContext
    );
    const labels = items.map((i: any) => i.label);
    expect(labels).toContain('elk');
    expect(labels).toContain('dagre');
  });

  it('should provide pricing model completions', () => {
    const content = `cost:
  pricing_model: `;
    const doc = createMockDocument(content);
    const position = createMockPosition(1, 18);

    const items = provider.provideCompletionItems(
      doc,
      position,
      mockToken,
      mockContext
    );
    const labels = items.map((i: any) => i.label);
    expect(labels).toContain('on-demand');
    expect(labels).toContain('reserved-1yr');
  });

  it('should include service details in completion items', () => {
    const content = `services:
        - id: svc-1
          service: `;
    const doc = createMockDocument(content);
    const position = createMockPosition(2, 19);

    const items = provider.provideCompletionItems(
      doc,
      position,
      mockToken,
      mockContext
    );
    const ec2Item = items.find((i: any) => i.label === 'ec2');
    expect(ec2Item).toBeDefined();
    expect(ec2Item.detail).toContain('Amazon EC2');
    expect(ec2Item.detail).toContain('Compute');
  });
});

// ─── HoverProvider ────────────────────────────────────────────────────────────

describe('HoverProvider', () => {
  let HoverProvider: any;
  let provider: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../src/providers/hover-provider');
    HoverProvider = mod.HoverProvider;
    provider = new HoverProvider();
  });

  it('should instantiate without errors', () => {
    expect(provider).toBeDefined();
    expect(provider.provideHover).toBeInstanceOf(Function);
  });

  it('should provide hover info for AWS services', () => {
    const content = `services:
  - id: svc-1
    service: ec2`;
    const doc = createMockDocument(content);
    const position = createMockPosition(2, 15);

    // Mock getWordRangeAtPosition
    doc.getWordRangeAtPosition = (pos: any, _regex?: RegExp) => ({
      start: { line: 2, character: 14 },
      end: { line: 2, character: 17 },
    });
    doc.getText = (range?: any) => {
      if (range) return 'ec2';
      return content;
    };

    const hover = provider.provideHover(doc as any, position, mockToken);
    expect(hover).not.toBeNull();
    expect(hover.contents.value).toContain('Amazon EC2');
    expect(hover.contents.value).toContain('Compute');
  });

  it('should provide hover info for GCP services', () => {
    const content = `services:
  - id: svc-1
    service: cloud-run`;
    const doc = createMockDocument(content);
    const position = createMockPosition(2, 15);

    doc.getWordRangeAtPosition = () => ({
      start: { line: 2, character: 14 },
      end: { line: 2, character: 23 },
    });
    doc.getText = (range?: any) => {
      if (range) return 'cloud-run';
      return content;
    };

    const hover = provider.provideHover(doc as any, position, mockToken);
    expect(hover).not.toBeNull();
    expect(hover.contents.value).toContain('Cloud Run');
    expect(hover.contents.value).toContain('GCP');
  });

  it('should provide hover info for top-level keys', () => {
    const content = `version: '0.1'`;
    const doc = createMockDocument(content);
    const position = createMockPosition(0, 3);

    doc.getWordRangeAtPosition = () => ({
      start: { line: 0, character: 0 },
      end: { line: 0, character: 7 },
    });
    doc.getText = (range?: any) => {
      if (range) return 'version';
      return content;
    };

    const hover = provider.provideHover(doc as any, position, mockToken);
    expect(hover).not.toBeNull();
    expect(hover.contents.value).toContain('ADAC Version');
  });

  it('should provide hover for connection types', () => {
    const content = `connections:
  - id: c1
    type: api-call`;
    const doc = createMockDocument(content);
    const position = createMockPosition(2, 12);

    doc.getWordRangeAtPosition = () => ({
      start: { line: 2, character: 10 },
      end: { line: 2, character: 18 },
    });
    doc.getText = (range?: any) => {
      if (range) return 'api-call';
      return content;
    };

    const hover = provider.provideHover(doc as any, position, mockToken);
    expect(hover).not.toBeNull();
    expect(hover.contents.value).toContain('api-call');
  });

  it('should return null when no relevant hover context', () => {
    const content = `some_random: value`;
    const doc = createMockDocument(content);
    const position = createMockPosition(0, 15);

    doc.getWordRangeAtPosition = () => ({
      start: { line: 0, character: 14 },
      end: { line: 0, character: 19 },
    });
    doc.getText = (range?: any) => {
      if (range) return 'value';
      return content;
    };

    const hover = provider.provideHover(doc as any, position, mockToken);
    expect(hover).toBeNull();
  });

  it('should return null when no word range', () => {
    const content = `   `;
    const doc = createMockDocument(content);
    const position = createMockPosition(0, 1);

    doc.getWordRangeAtPosition = () => undefined;
    doc.getText = (range?: any) => {
      if (range) return '';
      return content;
    };

    const hover = provider.provideHover(doc as any, position, mockToken);
    expect(hover).toBeNull();
  });

  it('should show ID references on hover', () => {
    const content = `applications:
  - id: my-app
connections:
  - id: conn-1
    from: my-app
    to: svc-1`;
    const doc = createMockDocument(content);
    const position = createMockPosition(1, 10);

    doc.getWordRangeAtPosition = () => ({
      start: { line: 1, character: 8 },
      end: { line: 1, character: 14 },
    });
    doc.getText = (range?: any) => {
      if (range) return 'my-app';
      return content;
    };

    const hover = provider.provideHover(doc as any, position, mockToken);
    expect(hover).not.toBeNull();
    expect(hover.contents.value).toContain('my-app');
    expect(hover.contents.value).toContain('Referenced');
  });

  it('should provide hover for compliance frameworks', () => {
    const content = `compliance:
  - hipaa`;
    const doc = createMockDocument(content);
    const position = createMockPosition(1, 5);

    doc.getWordRangeAtPosition = () => ({
      start: { line: 1, character: 4 },
      end: { line: 1, character: 9 },
    });
    doc.getText = (range?: any) => {
      if (range) return 'hipaa';
      return content;
    };

    const hover = provider.provideHover(doc as any, position, mockToken);
    expect(hover).not.toBeNull();
    expect(hover.contents.value).toContain('HIPAA');
  });
});

describe('Validate Command', () => {
  let vscode: any;
  let diagnosticProvider: any;
  let registerValidateCommand: any;
  let mockContext: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vscode = await import('vscode');
    const mod = await import('../src/commands/validate');
    registerValidateCommand = mod.registerValidateCommand;

    const diagMod = await import('../src/providers/diagnostic-provider');
    diagnosticProvider = new diagMod.DiagnosticProvider();
    mockContext = { subscriptions: [] as any[] };
  });

  it('should register the adac.validate command', () => {
    registerValidateCommand(mockContext, diagnosticProvider);
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      'adac.validate',
      expect.any(Function)
    );
  });

  it('should show warning if no active editor', () => {
    registerValidateCommand(mockContext, diagnosticProvider);
    const callback = vscode.commands.registerCommand.mock.calls.find(
      (call: any) => call[0] === 'adac.validate'
    )[1];

    vscode.window.activeTextEditor = null;
    callback();

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('No active editor')
    );
  });

  it('should show success message if no diagnostics found', () => {
    registerValidateCommand(mockContext, diagnosticProvider);
    const callback = vscode.commands.registerCommand.mock.calls.find(
      (call: any) => call[0] === 'adac.validate'
    )[1];

    vscode.window.activeTextEditor = {
      document: {
        languageId: 'adac-yaml',
        fileName: 'test.adac.yaml',
        getText: () => 'infrastructure: {}',
        uri: { fsPath: 'test.adac.yaml' },
      },
    };

    vi.spyOn(diagnosticProvider, 'validateDocument').mockReturnValue([]);

    callback();

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('passed')
    );
  });

  it('should show error message if errors are found', () => {
    registerValidateCommand(mockContext, diagnosticProvider);
    const callback = vscode.commands.registerCommand.mock.calls.find(
      (call: any) => call[0] === 'adac.validate'
    )[1];

    vscode.window.activeTextEditor = {
      document: {
        languageId: 'adac-yaml',
        fileName: 'test.adac.yaml',
        getText: () => 'infrastructure: {}',
        uri: { fsPath: 'test.adac.yaml' },
      },
    };

    vi.spyOn(diagnosticProvider, 'validateDocument').mockReturnValue([
      { severity: vscode.DiagnosticSeverity.Error, message: 'Bad' },
    ]);

    callback();

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('failed')
    );
  });
});

describe('Format Command', () => {
  let vscode: any;
  let registerFormatCommand: any;
  let mockContext: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vscode = await import('vscode');
    const mod = await import('../src/commands/format');
    registerFormatCommand = mod.registerFormatCommand;
    mockContext = { subscriptions: [] as any[] };
  });

  it('should register the adac.formatDocument command', () => {
    registerFormatCommand(mockContext);
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      'adac.formatDocument',
      expect.any(Function)
    );
  });

  it('should format document successfully', async () => {
    registerFormatCommand(mockContext);
    const callback = vscode.commands.registerCommand.mock.calls.find(
      (call: any) => call[0] === 'adac.formatDocument'
    )[1];

    const mockEdit = vi.fn().mockImplementation((cb) => {
      cb({ replace: vi.fn() });
      return Promise.resolve(true);
    });

    vscode.window.activeTextEditor = {
      document: {
        languageId: 'adac-yaml',
        fileName: 'test.adac.yaml',
        getText: () => 'infrastructure:\n  clouds: []',
        positionAt: (idx: number) => ({ line: 0, character: idx }),
      },
      edit: mockEdit,
    };

    await callback();

    expect(mockEdit).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('formatted successfully')
    );
  });

  it('should show error message if formatting fails', async () => {
    registerFormatCommand(mockContext);
    const callback = vscode.commands.registerCommand.mock.calls.find(
      (call: any) => call[0] === 'adac.formatDocument'
    )[1];

    vscode.window.activeTextEditor = {
      document: {
        languageId: 'adac-yaml',
        fileName: 'test.adac.yaml',
        getText: () => '--- invalid yaml: [',
      },
    };

    await callback();

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to format')
    );
  });
});

describe('Preview Diagram Command', () => {
  let vscode: any;
  let registerPreviewDiagramCommand: any;
  let mockContext: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vscode = await import('vscode');
    const mod = await import('../src/commands/preview-diagram');
    registerPreviewDiagramCommand = mod.registerPreviewDiagramCommand;
    mockContext = { subscriptions: [] as any[] };
  });

  it('should register the adac.previewDiagram command', () => {
    registerPreviewDiagramCommand(mockContext);
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      'adac.previewDiagram',
      expect.any(Function)
    );
  });

  it('should create webview panel on invocation', async () => {
    registerPreviewDiagramCommand(mockContext);
    const callback = vscode.commands.registerCommand.mock.calls.find(
      (call: any) => call[0] === 'adac.previewDiagram'
    )[1];

    const mockWebview = { html: '' };
    const mockPanel = {
      webview: mockWebview,
      onDidDispose: vi.fn(),
      reveal: vi.fn(),
    };

    vscode.window.createWebviewPanel = vi.fn().mockReturnValue(mockPanel);
    vscode.window.activeTextEditor = {
      document: {
        languageId: 'adac-yaml',
        fileName: 'test.adac.yaml',
        getText: () => 'infrastructure: {}',
      },
    };

    await callback();

    expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
    expect(mockWebview.html).toContain('ADAC Diagram');
    expect(mockWebview.html).toContain('<svg');
  });

  it('should show warning if no active editor', async () => {
    registerPreviewDiagramCommand(mockContext);
    const callback = vscode.commands.registerCommand.mock.calls.find(
      (call: any) => call[0] === 'adac.previewDiagram'
    )[1];

    vscode.window.activeTextEditor = null;
    await callback();

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('No active editor')
    );
  });
});

// ─── Extension Entry Point ───────────────────────────────────────────────────

describe('Extension Entry Point', () => {
  it('should export activate and deactivate functions', async () => {
    const ext = await import('../src/extension');
    expect(ext.activate).toBeInstanceOf(Function);
    expect(ext.deactivate).toBeInstanceOf(Function);
  });

  it('should activate without throwing', async () => {
    const ext = await import('../src/extension');
    const mockContext = {
      subscriptions: [] as any[],
    };

    expect(() => ext.activate(mockContext as any)).not.toThrow();
    // Activation should register providers and commands
    expect(mockContext.subscriptions.length).toBeGreaterThan(0);
  });

  it('should deactivate without throwing', async () => {
    const ext = await import('../src/extension');
    expect(() => ext.deactivate()).not.toThrow();
  });

  it('should register completion provider', async () => {
    const vscode = await import('vscode');
    const ext = await import('../src/extension');
    const mockContext = { subscriptions: [] as any[] };

    ext.activate(mockContext as any);

    expect(vscode.languages.registerCompletionItemProvider).toHaveBeenCalled();
  });

  it('should register hover provider', async () => {
    const vscode = await import('vscode');
    const ext = await import('../src/extension');
    const mockContext = { subscriptions: [] as any[] };

    ext.activate(mockContext as any);

    expect(vscode.languages.registerHoverProvider).toHaveBeenCalled();
  });

  it('should register all three commands', async () => {
    const vscode = await import('vscode');
    const ext = await import('../src/extension');
    const mockContext = { subscriptions: [] as any[] };

    ext.activate(mockContext as any);

    const registerCalls = (vscode.commands.registerCommand as any).mock.calls;
    const commandNames = registerCalls.map((c: any[]) => c[0]);
    expect(commandNames).toContain('adac.validate');
    expect(commandNames).toContain('adac.formatDocument');
    expect(commandNames).toContain('adac.previewDiagram');
  });

  it('should create a status bar item', async () => {
    const vscode = await import('vscode');
    const ext = await import('../src/extension');
    const mockContext = { subscriptions: [] as any[] };

    ext.activate(mockContext as any);

    expect(vscode.window.createStatusBarItem).toHaveBeenCalled();
  });
});

// ─── Types ────────────────────────────────────────────────────────────────────

describe('Types', () => {
  it('should export type interfaces', async () => {
    // TypeScript types don't exist at runtime, but we can verify the module loads
    const types = await import('../src/types/index');
    expect(types).toBeDefined();
  });
});

// ─── Edge Cases & Integration ─────────────────────────────────────────────────

describe('Edge Cases', () => {
  let diagnosticProvider: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { DiagnosticProvider } =
      await import('../src/providers/diagnostic-provider');
    diagnosticProvider = new DiagnosticProvider();
  });

  it('should handle very large YAML documents', () => {
    let bigYaml = `version: '0.1'\nmetadata:\n  name: 'Big'\n  created: '2026-01-01'\ninfrastructure:\n  clouds:\n    - id: 'c1'\n      provider: aws\n      region: us-east-1\n      services:\n`;
    for (let i = 0; i < 100; i++) {
      bigYaml += `        - id: 'svc-${i}'\n          service: ec2\n`;
    }
    const doc = createMockDocument(bigYaml);
    const diagnostics = diagnosticProvider.validateDocument(doc);
    const errors = diagnostics.filter((d: any) => d.severity === 0);
    expect(errors.length).toBe(0);
  });

  it('should handle document with special characters in values', () => {
    const doc = createMockDocument(`version: '0.1'
metadata:
  name: "Arch with <special> & 'chars'"
  created: '2026-01-01'
infrastructure:
  clouds:
    - id: 'c1'
      provider: aws
      region: us-east-1`);

    const diagnostics = diagnosticProvider.validateDocument(doc);
    // Should not crash
    expect(diagnostics).toBeDefined();
  });

  it('should handle document with unicode characters', () => {
    const doc = createMockDocument(`version: '0.1'
metadata:
  name: 'アーキテクチャ 日本語'
  created: '2026-01-01'
infrastructure:
  clouds:
    - id: 'c1'
      provider: aws
      region: ap-northeast-1`);

    const diagnostics = diagnosticProvider.validateDocument(doc);
    expect(diagnostics).toBeDefined();
  });

  it('should handle multiple clouds with cross-cloud connections', () => {
    const doc = createMockDocument(`version: '0.1'
metadata:
  name: 'Multi-Cloud'
  created: '2026-01-01'
infrastructure:
  clouds:
    - id: 'aws-1'
      provider: aws
      region: us-east-1
      services:
        - id: 'aws-svc'
          service: ec2
    - id: 'gcp-1'
      provider: gcp
      region: us-central1
      services:
        - id: 'gcp-svc'
          service: cloud-run
connections:
  - id: 'cross-cloud'
    from: 'aws-svc'
    to: 'gcp-svc'
    type: api-call`);

    const diagnostics = diagnosticProvider.validateDocument(doc);
    const errors = diagnostics.filter((d: any) => d.severity === 0);
    expect(errors.length).toBe(0);
  });

  it('should catch both invalid from AND to refs in connections', () => {
    const doc = createMockDocument(`version: '0.1'
metadata:
  name: 'Test'
  created: '2026-01-01'
infrastructure:
  clouds:
    - id: 'c1'
      provider: aws
      region: us-east-1
      services:
        - id: 'svc-1'
          service: ec2
connections:
  - id: 'conn-bad'
    from: 'bad-from'
    to: 'bad-to'
    type: api-call`);

    const diagnostics = diagnosticProvider.validateDocument(doc);
    const msgs = diagnostics.map((d: any) => d.message);
    expect(msgs.some((m: string) => m.includes('bad-from'))).toBe(true);
    expect(msgs.some((m: string) => m.includes('bad-to'))).toBe(true);
  });
});
