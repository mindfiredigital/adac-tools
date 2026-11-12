import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { generateDiagram, generateDiagramSvg } from '../src/generator.js';

const yaml = (extra: string) => `version: '0.2'
metadata:
  name: Engine Warning
  created: '2026-01-01'
${extra}
infrastructure:
  clouds:
    - id: aws-main
      provider: aws
      region: us-east-1
      services:
        - id: web
          name: Web
          service: ec2
        - id: db
          name: Database
          service: rds-postgres
connections:
  - id: c1
    from: web
    to: db
    type: api-call
`;

const DECLARATIVE = `layoutOptions:
  direction: TB
  gap: 0.5`;
const SHARED_ONLY = `layoutOptions:
  unitSize: 100
  background: true
  edgeLabels: false
  labelMaxChars: 18`;

const warnings = (logs: string[]) =>
  logs.filter((l) => /Warning: Layout engine/.test(l));

describe('unsupported layout engine warning', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(['custom', 'orthogonal', 'tsm'] as const)(
    'logs one warning for %s and still renders',
    async (engine) => {
      const result = await generateDiagramSvg(
        yaml(DECLARATIVE),
        engine,
        false,
        undefined,
        'monthly',
        true
      );
      expect(result.svg).toContain('<svg');
      const found = warnings(result.logs);
      expect(found).toHaveLength(1);
      expect(found[0]).toContain(`Layout engine "${engine}"`);
      expect(found[0]).toContain('layoutOptions (direction, gap)');
      expect(found[0]).toContain('--layout elk');
    }
  );

  it('uses the engine the file selects itself', async () => {
    const { logs } = await generateDiagramSvg(
      yaml(`layoutOptions:\n  engine: custom\n  gap: 0.5`),
      undefined,
      false,
      undefined,
      'monthly',
      true
    );
    expect(warnings(logs)).toHaveLength(1);
  });

  it('warns once, not twice, when --validate is on', async () => {
    const { logs } = await generateDiagramSvg(
      yaml(DECLARATIVE),
      'custom',
      true,
      undefined,
      'monthly',
      true
    );
    expect(warnings(logs)).toHaveLength(1);
  });

  it('is silent on elk', async () => {
    const { logs } = await generateDiagramSvg(
      yaml(DECLARATIVE),
      'elk',
      false,
      undefined,
      'monthly',
      true
    );
    expect(warnings(logs)).toHaveLength(0);
  });

  it('is silent for a file with no declarative properties', async () => {
    for (const engine of ['custom', 'orthogonal', 'tsm'] as const) {
      const { logs } = await generateDiagramSvg(
        yaml(''),
        engine,
        false,
        undefined,
        'monthly',
        true
      );
      expect(warnings(logs)).toHaveLength(0);
    }
  });

  it('is silent for properties every engine supports', async () => {
    const { logs } = await generateDiagramSvg(
      yaml(SHARED_ONLY),
      'custom',
      false,
      undefined,
      'monthly',
      true
    );
    expect(warnings(logs)).toHaveLength(0);
  });

  it('prints the warning to the console when generating a file', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'adac-engine-'));
    try {
      const input = path.join(dir, 'in.adac.yaml');
      const output = path.join(dir, 'out.svg');
      await fs.writeFile(input, yaml(DECLARATIVE));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});

      await generateDiagram(
        input,
        output,
        'custom',
        true,
        undefined,
        'monthly',
        true
      );

      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toMatch(
        /^Warning: Layout engine "custom" ignores declarative layout properties/
      );
      expect(await fs.pathExists(output)).toBe(true);
    } finally {
      await fs.remove(dir);
    }
  });
});
