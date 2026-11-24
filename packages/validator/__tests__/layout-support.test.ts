import { describe, it, expect } from 'vitest';
import { validateAdacConfig } from '../src/validator.js';
import {
  collectDeclaredLayoutProperties,
  unsupportedLayoutEngineWarning,
} from '../src/layout-support.js';

type Json = Record<string, unknown>;

function config(overrides: Json = {}, serviceVisual?: Json): Json {
  return {
    version: '0.2',
    metadata: { name: 'Engine Warning', created: '2026-01-01' },
    infrastructure: {
      clouds: [
        {
          id: 'aws-main',
          provider: 'aws',
          region: 'us-east-1',
          services: [
            {
              id: 'vpc',
              service: 'ec2',
              ...(serviceVisual ? { visual: serviceVisual } : {}),
            },
            { id: 'db', service: 'ec2' },
          ],
        },
      ],
    },
    connections: [{ id: 'c1', from: 'vpc', to: 'db', type: 'api-call' }],
    ...overrides,
  };
}

const warningsOf = (cfg: Json, engine?: 'elk' | 'custom') =>
  validateAdacConfig(cfg, engine ? { engine } : {}).warnings ?? [];

const withBidirectional = (value: unknown) =>
  config({
    connections: [
      {
        id: 'c1',
        from: 'vpc',
        to: 'db',
        type: 'api-call',
        bidirectional: value,
      },
    ],
  });

describe('collectDeclaredLayoutProperties', () => {
  it('lists the ELK-only properties written in each group', () => {
    const declared = collectDeclaredLayoutProperties(
      config(
        {
          layoutOptions: { direction: 'LR', gap: 1, unitSize: 100 },
          connections: [
            {
              id: 'c1',
              from: 'vpc',
              to: 'db',
              type: 'api-call',
              layout: { fromSide: 'right' },
            },
          ],
        },
        { layout: { align: 'center', order: 1 } }
      )
    );
    expect(declared).toEqual({
      layoutOptions: ['direction', 'gap'],
      elementLayout: ['align', 'order'],
      connectionLayout: ['fromSide'],
    });
  });

  it('counts the deprecated routing alias as edgeRouting', () => {
    const declared = collectDeclaredLayoutProperties(
      config({ layoutOptions: { routing: 'orthogonal' } })
    );
    expect(declared.layoutOptions).toEqual(['routing']);
  });

  it('ignores properties every engine supports', () => {
    const declared = collectDeclaredLayoutProperties(
      config({
        layoutOptions: {
          unitSize: 80,
          background: true,
          edgeLabels: false,
          labelMaxChars: 20,
        },
      })
    );
    expect(declared).toEqual({
      layoutOptions: [],
      elementLayout: [],
      connectionLayout: [],
    });
  });

  it('ignores size, minSize and maxSize, which every engine applies to leaves', () => {
    const declared = collectDeclaredLayoutProperties(
      config(
        {},
        {
          layout: {
            size: { width: 2 },
            minSize: { width: 1 },
            maxSize: { width: 3 },
          },
        }
      )
    );
    expect(declared.elementLayout).toEqual([]);
  });

  it('tolerates a malformed document', () => {
    expect(() => collectDeclaredLayoutProperties(null)).not.toThrow();
    expect(() =>
      collectDeclaredLayoutProperties({ layoutOptions: 'x', connections: 3 })
    ).not.toThrow();
  });

  it('counts an enabled bidirectional flag as ELK-only', () => {
    const declared = collectDeclaredLayoutProperties(withBidirectional(true));
    expect(declared.connectionLayout).toEqual(['bidirectional']);
  });

  it('ignores bidirectional: false, the default every engine already shows', () => {
    const declared = collectDeclaredLayoutProperties(withBidirectional(false));
    expect(declared.connectionLayout).toEqual([]);
  });
});

describe('unsupportedLayoutEngineWarning', () => {
  const declarative = config({
    layoutOptions: { engine: 'custom', direction: 'TB', gap: 1 },
    connections: [
      {
        id: 'c1',
        from: 'vpc',
        to: 'db',
        type: 'api-call',
        layout: { toSide: 'left', routing: 'orthogonal' },
      },
    ],
  });

  it('names the engine, the ignored groups and the fix', () => {
    const warning = unsupportedLayoutEngineWarning(declarative, 'custom');
    expect(warning).toContain('Layout engine "custom"');
    expect(warning).toContain('layoutOptions (direction, gap)');
    expect(warning).toContain('connection layout (routing, toSide)');
    expect(warning).toContain('--layout elk');
    expect(warning).toContain('layoutOptions.engine: elk');
  });

  it('is silent on elk', () => {
    expect(unsupportedLayoutEngineWarning(declarative, 'elk')).toBeUndefined();
  });

  it('is silent for an unknown engine, which the schema rejects instead', () => {
    expect(unsupportedLayoutEngineWarning(declarative, 'foo')).toBeUndefined();
    const result = validateAdacConfig(
      config({ layoutOptions: { engine: 'foo', gap: 1 } })
    );
    expect(result.valid).toBe(false);
    expect(result.warnings ?? []).toEqual([]);
  });

  it('is silent when nothing declarative is written', () => {
    expect(unsupportedLayoutEngineWarning(config(), 'tsm')).toBeUndefined();
  });

  it('is silent for bidirectional: false on a non-elk engine', () => {
    expect(
      unsupportedLayoutEngineWarning(withBidirectional(false), 'custom')
    ).toBeUndefined();
  });

  it('warns about an enabled bidirectional flag on a non-elk engine', () => {
    expect(
      unsupportedLayoutEngineWarning(withBidirectional(true), 'custom')
    ).toContain('connection layout (bidirectional)');
  });

  it('is silent for properties that work on every engine', () => {
    const shared = config({
      layoutOptions: { unitSize: 80, background: true, labelMaxChars: 20 },
    });
    expect(
      unsupportedLayoutEngineWarning(shared, 'orthogonal')
    ).toBeUndefined();
  });
});

describe('validateAdacConfig engine warning', () => {
  it('warns once for a file that selects a non-elk engine itself', () => {
    const cfg = config(
      { layoutOptions: { engine: 'custom', gap: 1 } },
      { layout: { align: 'center' } }
    );
    const warnings = warningsOf(cfg).filter((w) =>
      /ignores declarative/.test(w)
    );
    expect(warnings).toHaveLength(1);
  });

  it('uses the top-level layout when layoutOptions.engine is absent', () => {
    const cfg = config({ layout: 'tsm', layoutOptions: { gap: 1 } });
    expect(warningsOf(cfg).some((w) => /"tsm"/.test(w))).toBe(true);
  });

  it('lets an engine override replace the file engine', () => {
    const cfg = config({ layoutOptions: { engine: 'elk', gap: 1 } });
    expect(warningsOf(cfg)).toEqual([]);
    expect(warningsOf(cfg, 'custom')).toHaveLength(1);
    const custom = config({ layoutOptions: { engine: 'custom', gap: 1 } });
    expect(warningsOf(custom, 'elk')).toEqual([]);
  });

  it('does not warn for a plain file on any engine', () => {
    expect(warningsOf(config({ layout: 'custom' }))).toEqual([]);
  });

  it('does not warn on elk even with declarative properties', () => {
    expect(warningsOf(config({ layoutOptions: { gap: 1 } }))).toEqual([]);
  });

  it('keeps the file valid', () => {
    const cfg = config({ layoutOptions: { engine: 'custom', gap: 1 } });
    expect(validateAdacConfig(cfg).valid).toBe(true);
  });
});
