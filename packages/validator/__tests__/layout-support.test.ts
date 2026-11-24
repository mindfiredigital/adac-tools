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

  it('ignores size, minSize and maxSize on a leaf, which every engine applies', () => {
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

  describe('size, minSize and maxSize on containers', () => {
    const sizes = {
      layout: {
        size: { width: 2 },
        minSize: { width: 1 },
        maxSize: { width: 3 },
      },
    };
    /** `vpc` (with `visual`) and `other`, built by `make`; `db` is a plain leaf. */
    const withServices = (
      make: (visual: Json) => Json[],
      applications: Json[] = []
    ) =>
      config({
        applications,
        infrastructure: {
          clouds: [
            {
              id: 'aws-main',
              provider: 'aws',
              region: 'us-east-1',
              services: make(sizes),
            },
          ],
        },
      });
    const elementLayoutOf = (cfg: Json) =>
      collectDeclaredLayoutProperties(cfg).elementLayout;

    it('lists them for a container that others name as their vpc', () => {
      const cfg = withServices((visual) => [
        { id: 'vpc', service: 'vpc', visual },
        { id: 'db', service: 'rds', config: { vpc: 'vpc' } },
      ]);
      expect(elementLayoutOf(cfg)).toEqual(['maxSize', 'minSize', 'size']);
    });

    it('lists them for a subnet that others name in `subnets`', () => {
      const cfg = withServices((visual) => [
        { id: 'sn', service: 'subnet', visual },
        { id: 'db', service: 'rds', subnets: ['sn'] },
      ]);
      expect(elementLayoutOf(cfg)).toEqual(['maxSize', 'minSize', 'size']);
    });

    it('lists them for a service that runs an application', () => {
      const cfg = withServices(
        (visual) => [{ id: 'svc', service: 'ecs', runs: ['app'], visual }],
        [{ id: 'app', type: 'service' }]
      );
      expect(elementLayoutOf(cfg)).toEqual(['maxSize', 'minSize', 'size']);
    });

    it('leaves them out when the application it runs does not exist', () => {
      const cfg = withServices((visual) => [
        { id: 'svc', service: 'ecs', runs: ['missing'], visual },
      ]);
      expect(elementLayoutOf(cfg)).toEqual([]);
    });

    it('leaves them out for an application another service already runs', () => {
      const cfg = withServices(
        (visual) => [
          { id: 'first', service: 'ecs', runs: ['app'] },
          { id: 'second', service: 'ecs', runs: ['app'], visual },
        ],
        [{ id: 'app', type: 'service' }]
      );
      expect(elementLayoutOf(cfg)).toEqual([]);
    });

    it('leaves them out for a parent that does not exist', () => {
      const cfg = withServices((visual) => [
        { id: 'vpc', service: 'vpc', visual },
        { id: 'db', service: 'rds', config: { vpc: 'other' } },
      ]);
      expect(elementLayoutOf(cfg)).toEqual([]);
    });

    it('leaves them out for a service that names itself', () => {
      const cfg = withServices((visual) => [
        { id: 'sn', service: 'subnet', config: { vpc: 'sn' }, visual },
      ]);
      expect(elementLayoutOf(cfg)).toEqual([]);
    });

    it('credits the subnet, not the vpc, when a service names both', () => {
      const services = (visual: Json) => [
        { id: 'vpc', service: 'vpc', visual },
        { id: 'sn', service: 'subnet' },
        { id: 'db', service: 'rds', config: { vpc: 'vpc' }, subnets: ['sn'] },
      ];
      expect(elementLayoutOf(withServices(services))).toEqual([]);
    });

    it('credits the vpc, not a subnet, when several subnets are named', () => {
      const services = (visual: Json) => [
        { id: 'vpc', service: 'vpc' },
        { id: 'a', service: 'subnet', config: { vpc: 'vpc' }, visual },
        { id: 'b', service: 'subnet', config: { vpc: 'vpc' } },
        { id: 'db', service: 'rds', subnets: ['a', 'b'] },
      ];
      expect(elementLayoutOf(withServices(services))).toEqual([]);
    });

    it('skips a subnet reference that is not a string', () => {
      const cfg = config({
        layoutOptions: { engine: 'custom' },
        infrastructure: {
          clouds: [
            {
              id: 'aws-main',
              provider: 'aws',
              region: 'us-east-1',
              services: [
                {
                  id: 'db',
                  service: 'rds',
                  config: { subnets: [{ toString: null }, 'missing'] },
                },
              ],
            },
          ],
        },
      });
      expect(() => collectDeclaredLayoutProperties(cfg)).not.toThrow();
      const result = validateAdacConfig(cfg);
      expect(result).toHaveProperty('valid');
    });

    it('lists them for a subnet an unparented service is placed in', () => {
      const cfg = withServices((visual) => [
        { id: 'vpc', service: 'vpc' },
        { id: 'sn', service: 'subnet', config: { vpc: 'vpc' }, visual },
        { id: 'db', service: 'rds' },
      ]);
      expect(elementLayoutOf(cfg)).toEqual(['maxSize', 'minSize', 'size']);
    });

    it('leaves them out for a subnet that stays empty', () => {
      // s3 is not VPC-bound, so the builder leaves it outside the VPC
      const cfg = withServices((visual) => [
        { id: 'vpc', service: 'vpc' },
        { id: 'sn', service: 'subnet', config: { vpc: 'vpc' }, visual },
        { id: 'bucket', service: 's3' },
      ]);
      expect(elementLayoutOf(cfg)).toEqual([]);
    });

    it('places an unparented service in the subnet with the fewest children', () => {
      const cfg = withServices((visual) => [
        { id: 'vpc', service: 'vpc' },
        { id: 'a', service: 'subnet', config: { vpc: 'vpc' } },
        { id: 'b', service: 'subnet', config: { vpc: 'vpc' }, visual },
        { id: 'db1', service: 'rds', subnets: ['a'] },
        { id: 'db2', service: 'rds' },
      ]);
      expect(elementLayoutOf(cfg)).toEqual(['maxSize', 'minSize', 'size']);
    });

    it('skips a service whose type is not a string', () => {
      const cfg = withServices((visual) => [
        { id: 'vpc', service: 'vpc' },
        { id: 'sn', service: 'subnet', config: { vpc: 'vpc' }, visual },
        { id: 'odd', service: { toString: null } },
        { id: 'db', service: 'rds' },
      ]);
      expect(() => collectDeclaredLayoutProperties(cfg)).not.toThrow();
      // the valid subnet still takes the unparented rds
      expect(elementLayoutOf(cfg)).toEqual(['maxSize', 'minSize', 'size']);
    });

    it('credits the vpc of a subnet placed in an availability zone', () => {
      const cfg = withServices((visual) => [
        { id: 'vpc', service: 'vpc', visual },
        {
          id: 'sn',
          service: 'subnet',
          config: { vpc: 'vpc', availability_zone: 'a' },
        },
      ]);
      expect(elementLayoutOf(cfg)).toEqual(['maxSize', 'minSize', 'size']);
    });

    it('still leaves them out for a leaf next to a container', () => {
      const cfg = withServices((visual) => [
        { id: 'vpc', service: 'vpc' },
        { id: 'db', service: 'rds', config: { vpc: 'vpc' }, visual },
      ]);
      expect(elementLayoutOf(cfg)).toEqual([]);
    });

    it('keeps the other properties of a leaf and a container alike', () => {
      const cfg = withServices(() => [
        {
          id: 'vpc',
          service: 'vpc',
          visual: { layout: { align: 'center', ...sizes.layout } },
        },
        { id: 'db', service: 'rds', config: { vpc: 'vpc' } },
      ]);
      expect(elementLayoutOf(cfg)).toEqual([
        'align',
        'maxSize',
        'minSize',
        'size',
      ]);
    });

    it('warns on a non-elk engine, and not on elk', () => {
      const cfg = withServices((visual) => [
        { id: 'vpc', service: 'vpc', visual },
        { id: 'db', service: 'rds', config: { vpc: 'vpc' } },
      ]);
      expect(unsupportedLayoutEngineWarning(cfg, 'custom')).toContain(
        'visual.layout (maxSize, minSize, size)'
      );
      expect(unsupportedLayoutEngineWarning(cfg, 'elk')).toBeUndefined();
    });
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
