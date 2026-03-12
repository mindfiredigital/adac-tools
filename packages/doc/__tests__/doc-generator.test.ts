import { describe, it, expect } from 'vitest';
import { DocumentationGenerator } from '../src/doc-generator.js';
import { MarkdownRenderer } from '../src/renderers/markdown-renderer.js';
import { HtmlRenderer } from '../src/renderers/html-renderer.js';
import { AdacConfig } from '@mindfiredigital/adac-schema';

const mockModel: AdacConfig = {
  version: '0.1',
  metadata: {
    name: 'Test App',
    created: '2026-03-09',
    description: 'A test application',
  },
  infrastructure: {
    clouds: [
      {
        id: 'cloud1',
        provider: 'aws',
        region: 'us-east-1',
        services: [
          {
            id: 'db1',
            service: 'rds',
            type: 'database',
            description: 'Main database',
            tags: {},
            runs: []
          }
        ]
      }
    ]
  },
  connections: [
    {
      id: 'conn1',
      from: 'app1',
      to: 'db1',
      type: 'tcp'
    }
  ]
};

describe('DocumentationGenerator', () => {
  it('should generate markdown documentation', async () => {
    const generator = new DocumentationGenerator({ format: 'markdown' });
    const output = await generator.generate(mockModel);

    expect(output.format).toBe('markdown');
    expect(output.files.length).toBeGreaterThan(0);
    expect(output.files.some(f => f.name === 'architecture.md')).toBe(true);
    expect(output.files.some(f => f.name === 'services.md')).toBe(true);
  });

  it('should include cost and compliance sections if specified', async () => {
    const generator = new DocumentationGenerator({
      sections: ['cost', 'compliance'],
      includeCost: true,
      includeCompliance: true
    });
    const output = await generator.generate(mockModel);

    expect(output.files.some(f => f.name === 'cost.md')).toBe(true);
    expect(output.files.some(f => f.name === 'compliance.md')).toBe(true);
  });
});

describe('Renderers', () => {
  it('MarkdownRenderer should return files untouched but with .md extension', () => {
    const renderer = new MarkdownRenderer();
    const files = renderer.render([{ name: 'test', content: '# Hello', path: 'test.md' }]);
    expect(files[0].name).toBe('test.md');
  });

  it('HtmlRenderer should return parsed HTML content', async () => {
    const renderer = new HtmlRenderer();
    const files = await renderer.render([{ name: 'test.md', content: '# Hello', path: 'test.md' }]);
    expect(files[0].name).toBe('test.html');
    expect(files[0].content).toContain('<h1>Hello</h1>');
  });
});
