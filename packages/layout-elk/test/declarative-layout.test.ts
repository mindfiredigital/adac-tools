import { describe, it, expect, vi } from 'vitest';
import ELK from 'elkjs/lib/elk.bundled.js';
import type {
  AdacConfig,
  AdacConnection,
  AdacElementLayout,
  AdacLayoutOptions,
  AdacService,
} from '@mindfiredigital/adac-validator';
import { buildElkGraph } from '../src/elk-builder.js';
import { applyLayoutPostProcessing } from '../src/post-layout.js';
import { isLayoutOnlyEdge } from '../src/declarative-layout.js';
import type { ElkNode } from '../src/types.js';

// ── Harness ─────────────────────────────────────────────────────────────────

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Svc = Partial<AdacService> & {
  id: string;
  layout?: AdacElementLayout;
  background?: boolean;
  labelMaxChars?: number;
};

const elk = new ELK();

function service({
  layout,
  background,
  labelMaxChars,
  ...rest
}: Svc): AdacService {
  const visual: NonNullable<AdacService['visual']> = {};
  if (layout) visual.layout = layout;
  if (background !== undefined || labelMaxChars !== undefined)
    visual.style = {
      ...(background !== undefined ? { background } : {}),
      ...(labelMaxChars !== undefined ? { labelMaxChars } : {}),
    };
  return {
    service: 'ec2',
    ...rest,
    ...(Object.keys(visual).length ? { visual } : {}),
  } as AdacService;
}

function config(
  services: Svc[],
  opts: {
    layoutOptions?: AdacLayoutOptions;
    connections?: Partial<AdacConnection>[];
  } = {}
): AdacConfig {
  return {
    version: '0.2',
    metadata: { name: 'layout', created: '2026-01-01' },
    infrastructure: {
      clouds: [
        {
          id: 'aws',
          provider: 'aws',
          region: 'us-east-1',
          services: services.map(service),
        },
      ],
    },
    connections: (opts.connections ?? []).map((c, i) => ({
      id: `c${i}`,
      type: 'api-call',
      ...c,
    })) as AdacConnection[],
    // these tests exercise the arrangement mechanics, not the default profile
    layoutOptions: { defaults: 'none', ...opts.layoutOptions },
  };
}

async function run(cfg: AdacConfig) {
  const warnings: string[] = [];
  const graph = await buildElkGraph(cfg, {
    onWarning: (m) => warnings.push(m),
  });
  const out = (await elk.layout(graph as never)) as unknown as ElkNode;
  const layoutWarnings = applyLayoutPostProcessing(out);

  const boxes = new Map<string, Box>();
  const visit = (n: ElkNode, ox: number, oy: number) => {
    const x = ox + (n.x ?? 0);
    const y = oy + (n.y ?? 0);
    boxes.set(n.id, { x, y, w: n.width ?? 0, h: n.height ?? 0 });
    n.children?.forEach((c) => visit(c, x, y));
  };
  visit(out, 0, 0);

  const edges: { id: string; points: { x: number; y: number }[] }[] = [];
  const collect = (n: ElkNode) => {
    const frame = boxes.get(n.id)!;
    n.edges?.forEach((e) => {
      if (isLayoutOnlyEdge(e)) return;
      const s = e.sections?.[0];
      if (!s) return;
      const o = boxes.get(e.container ?? n.id) ?? frame;
      edges.push({
        id: e.id,
        points: [s.startPoint, ...(s.bendPoints ?? []), s.endPoint].map(
          (p) => ({ x: p.x + o.x, y: p.y + o.y })
        ),
      });
    });
    n.children?.forEach(collect);
  };
  collect(out);

  const box = (id: string): Box => {
    const b = boxes.get(id);
    if (!b) throw new Error(`no box for ${id}`);
    return b;
  };
  return { graph, out, box, boxes, edges, warnings, layoutWarnings };
}

const right = (b: Box) => b.x + b.w;
const bottom = (b: Box) => b.y + b.h;
const leftOf = (a: Box, b: Box) => right(a) <= b.x + 0.5;
const above = (a: Box, b: Box) => bottom(a) <= b.y + 0.5;
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - 0.5 &&
  inner.y >= outer.y - 0.5 &&
  right(inner) <= right(outer) + 0.5 &&
  bottom(inner) <= bottom(outer) + 0.5;
const overlaps = (a: Box, b: Box) =>
  a.x < right(b) - 0.5 &&
  b.x < right(a) - 0.5 &&
  a.y < bottom(b) - 0.5 &&
  b.y < bottom(a) - 0.5;
/** Share a horizontal band (items of different heights still form one row). */
const sameRow = (a: Box, b: Box) =>
  a.y < bottom(b) - 0.5 && b.y < bottom(a) - 0.5;
/** Share a vertical band. */
const sameColumn = (a: Box, b: Box) =>
  a.x < right(b) - 0.5 && b.x < right(a) - 0.5;

const inVpc = { configuration: { vpc: 'vpc' } };
const items = (n: number, prefix = 'n'): Svc[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    ...inVpc,
  }));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('declarative layout', () => {
  describe('hierarchy: root → containers → nodes', () => {
    it('nests nodes inside their container without overlap', async () => {
      const r = await run(
        config([{ id: 'vpc', service: 'vpc' }, ...items(3), { id: 'outside' }])
      );
      for (const id of ['n0', 'n1', 'n2']) {
        expect(inside(r.box(id), r.box('vpc'))).toBe(true);
      }
      expect(overlaps(r.box('n0'), r.box('n1'))).toBe(false);
      expect(overlaps(r.box('vpc'), r.box('outside'))).toBe(false);
    });

    it('leaves graphs without layout declarations untouched', async () => {
      const g = await buildElkGraph(
        config([{ id: 'vpc', service: 'vpc' }, ...items(2)])
      );
      const vpc = g.children!.find((c) => c.id === 'vpc')!;
      expect(vpc.children!.map((c) => c.id)).toEqual(['n0', 'n1']);
      expect(vpc.edges).toBeUndefined();
      expect(g.layoutOptions!['elk.direction']).toBe('RIGHT');
    });
  });

  describe('mixed LR / TB layouts at every level', () => {
    const services: Svc[] = [
      { id: 'vpc', service: 'vpc', layout: { direction: 'TB' } },
      { id: 'public', service: 'subnet', ...inVpc },
      {
        id: 'private',
        service: 'subnet',
        ...inVpc,
        layout: { direction: 'LR' },
      },
      { id: 'alb', configuration: { subnets: ['public'] } },
      { id: 'ecs', configuration: { subnets: ['private'] } },
      { id: 'db', service: 'rds', configuration: { subnets: ['private'] } },
    ];

    it('VPC stacks its subnets, the private subnet lays its children out in a row', async () => {
      const r = await run(config(services));
      expect(above(r.box('public'), r.box('private'))).toBe(true);
      expect(leftOf(r.box('ecs'), r.box('db'))).toBe(true);
      expect(sameRow(r.box('ecs'), r.box('db'))).toBe(true);
      expect(inside(r.box('ecs'), r.box('private'))).toBe(true);
      expect(inside(r.box('db'), r.box('private'))).toBe(true);
      expect(inside(r.box('private'), r.box('vpc'))).toBe(true);
    });

    it('a container controls only its direct children', async () => {
      // Same tree, but the VPC declares LR: the subnets sit side by side while
      // the private subnet (TB) still stacks its own children.
      const r = await run(
        config([
          { id: 'vpc', service: 'vpc', layout: { direction: 'LR' } },
          { id: 'a', service: 'subnet', ...inVpc },
          {
            id: 'b',
            service: 'subnet',
            ...inVpc,
            layout: { direction: 'TB' },
          },
          { id: 'x', configuration: { subnets: ['b'] } },
          { id: 'y', configuration: { subnets: ['b'] } },
        ])
      );
      expect(leftOf(r.box('a'), r.box('b'))).toBe(true);
      expect(above(r.box('x'), r.box('y'))).toBe(true);
      expect(sameColumn(r.box('x'), r.box('y'))).toBe(true);
    });

    it('descendants inherit the nearest declaring ancestor', async () => {
      const r = await run(
        config([
          { id: 'vpc', service: 'vpc', layout: { direction: 'TB' } },
          { id: 'sub', service: 'subnet', ...inVpc },
          { id: 'p', configuration: { subnets: ['sub'] } },
          { id: 'q', configuration: { subnets: ['sub'] } },
        ])
      );
      // `sub` declares nothing but inherits TB from the VPC
      expect(above(r.box('p'), r.box('q'))).toBe(true);
    });

    it('supports reversed directions (RL / BT)', async () => {
      const rl = await run(
        config([
          { id: 'vpc', service: 'vpc', layout: { direction: 'RL' } },
          ...items(3),
        ])
      );
      expect(leftOf(rl.box('n2'), rl.box('n1'))).toBe(true);
      expect(leftOf(rl.box('n1'), rl.box('n0'))).toBe(true);

      const bt = await run(
        config([
          { id: 'vpc', service: 'vpc', layout: { direction: 'BT' } },
          ...items(3),
        ])
      );
      expect(above(bt.box('n2'), bt.box('n1'))).toBe(true);
      expect(above(bt.box('n1'), bt.box('n0'))).toBe(true);
    });

    it('works when the global flow is top-to-bottom', async () => {
      const r = await run(
        config(
          [
            { id: 'vpc', service: 'vpc', layout: { direction: 'LR' } },
            ...items(3),
          ],
          { layoutOptions: { direction: 'TB' } }
        )
      );
      expect(leftOf(r.box('n0'), r.box('n1'))).toBe(true);
      expect(leftOf(r.box('n1'), r.box('n2'))).toBe(true);
      expect(sameRow(r.box('n0'), r.box('n2'))).toBe(true);
    });
  });

  describe('wrapping and packing', () => {
    it('itemsPerLine starts a new row after the exact count', async () => {
      const r = await run(
        config([
          {
            id: 'vpc',
            service: 'vpc',
            layout: { direction: 'LR', itemsPerLine: 2 },
          },
          ...items(5),
        ])
      );
      expect(sameRow(r.box('n0'), r.box('n1'))).toBe(true);
      expect(sameRow(r.box('n2'), r.box('n3'))).toBe(true);
      expect(above(r.box('n0'), r.box('n2'))).toBe(true);
      expect(above(r.box('n2'), r.box('n4'))).toBe(true);
      expect(leftOf(r.box('n0'), r.box('n1'))).toBe(true);
      // n4 is alone on the last row
      expect(sameRow(r.box('n4'), r.box('n3'))).toBe(false);
    });

    it('maxItemsPerLine balances the lines (5 items, max 4 → 3 + 2)', async () => {
      const r = await run(
        config([
          {
            id: 'vpc',
            service: 'vpc',
            layout: { direction: 'LR', maxItemsPerLine: 4 },
          },
          ...items(5),
        ])
      );
      const rows = new Map<number, string[]>();
      for (let i = 0; i < 5; i++) {
        const y = Math.round(r.box(`n${i}`).y);
        rows.set(y, [...(rows.get(y) ?? []), `n${i}`]);
      }
      expect([...rows.values()].map((v) => v.length).sort()).toEqual([2, 3]);
    });

    it('wraps into columns for a top-to-bottom container', async () => {
      const r = await run(
        config([
          {
            id: 'vpc',
            service: 'vpc',
            layout: { direction: 'TB', itemsPerLine: 2 },
          },
          ...items(4),
        ])
      );
      // each line is a column of two; columns sit side by side
      expect(sameColumn(r.box('n0'), r.box('n1'))).toBe(true);
      expect(above(r.box('n0'), r.box('n1'))).toBe(true);
      expect(sameColumn(r.box('n2'), r.box('n3'))).toBe(true);
      expect(leftOf(r.box('n0'), r.box('n2'))).toBe(true);
    });

    it('keeps every child inside the container and non-overlapping', async () => {
      const r = await run(
        config([
          { id: 'vpc', service: 'vpc', layout: { itemsPerLine: 3 } },
          ...items(7),
        ])
      );
      for (let i = 0; i < 7; i++) {
        expect(inside(r.box(`n${i}`), r.box('vpc'))).toBe(true);
        for (let j = i + 1; j < 7; j++) {
          expect(overlaps(r.box(`n${i}`), r.box(`n${j}`))).toBe(false);
        }
      }
    });

    it('does not leave layout-only structure visible to consumers', async () => {
      const r = await run(
        config([
          { id: 'vpc', service: 'vpc', layout: { itemsPerLine: 2 } },
          ...items(4),
        ])
      );
      const vpc = r.out.children!.find((c) => c.id === 'vpc')!;
      expect(
        vpc.children!.every((c) => c.properties?.type === 'layout-line')
      ).toBe(true);
      expect(vpc.edges!.every(isLayoutOnlyEdge)).toBe(true);
    });
  });

  describe('explicit ordering and relative position', () => {
    it('order decides the sequence of siblings', async () => {
      const r = await run(
        config([
          { id: 'vpc', service: 'vpc', layout: { direction: 'LR' } },
          { id: 'a', ...inVpc, layout: { order: 3 } },
          { id: 'b', ...inVpc, layout: { order: 1 } },
          { id: 'c', ...inVpc, layout: { order: 2 } },
        ])
      );
      expect(leftOf(r.box('b'), r.box('c'))).toBe(true);
      expect(leftOf(r.box('c'), r.box('a'))).toBe(true);
    });

    it('order is deterministic across runs', async () => {
      const cfg = config([
        { id: 'vpc', service: 'vpc', layout: { direction: 'LR' } },
        { id: 'a', ...inVpc, layout: { order: 2 } },
        { id: 'b', ...inVpc, layout: { order: 1 } },
      ]);
      const first = await run(cfg);
      const second = await run(cfg);
      expect(second.box('a')).toEqual(first.box('a'));
      expect(second.box('b')).toEqual(first.box('b'));
    });

    it('position pins an element to the first / last layer of the flow axis', async () => {
      // d → a → b → c
      const chain = (pin: Record<string, AdacElementLayout>) =>
        run(
          config(
            ['d', 'a', 'b', 'c'].map((id) => ({ id, layout: pin[id] })),
            {
              connections: [
                { from: 'd', to: 'a' },
                { from: 'a', to: 'b' },
                { from: 'b', to: 'c' },
              ],
            }
          )
        );

      const base = await chain({});
      expect(leftOf(base.box('d'), base.box('a'))).toBe(true);
      expect(leftOf(base.box('b'), base.box('c'))).toBe(true);

      // c would be last; pin it to the first layer (next to d) instead
      const first = await chain({ c: { position: 'center-left' } });
      expect(leftOf(first.box('c'), first.box('a'))).toBe(true);

      // d would be first; pin it to the last layer instead
      const last = await chain({ d: { position: 'center-right' } });
      expect(leftOf(last.box('a'), last.box('d'))).toBe(true);
    });

    it('position places elements at the start / end of an arranged container', async () => {
      const r = await run(
        config([
          { id: 'vpc', service: 'vpc', layout: { direction: 'TB' } },
          { id: 'low', ...inVpc, layout: { position: 'bottom-center' } },
          { id: 'mid', ...inVpc },
          { id: 'top', ...inVpc, layout: { position: 'top-center' } },
        ])
      );
      expect(above(r.box('top'), r.box('mid'))).toBe(true);
      expect(above(r.box('mid'), r.box('low'))).toBe(true);
    });

    it('positions are screen regions even in reversed containers', async () => {
      const r = await run(
        config([
          { id: 'vpc', service: 'vpc', layout: { direction: 'RL' } },
          { id: 'a', ...inVpc, layout: { position: 'center-left' } },
          { id: 'b', ...inVpc },
          { id: 'c', ...inVpc, layout: { position: 'center-right' } },
        ])
      );
      expect(leftOf(r.box('a'), r.box('b'))).toBe(true);
      expect(leftOf(r.box('b'), r.box('c'))).toBe(true);
    });

    it('order alone arranges a container along the inherited direction', async () => {
      const r = await run(
        config([
          { id: 'vpc', service: 'vpc' },
          { id: 'a', ...inVpc, layout: { order: 2 } },
          { id: 'b', ...inVpc, layout: { order: 1 } },
        ])
      );
      expect(leftOf(r.box('b'), r.box('a'))).toBe(true);
      expect(sameRow(r.box('a'), r.box('b'))).toBe(true);
    });
  });

  describe('spacing, padding, units', () => {
    it('gap is resolved through unitSize', async () => {
      const r = await run(
        config(
          [
            { id: 'vpc', service: 'vpc', layout: { direction: 'LR', gap: 2 } },
            ...items(2),
          ],
          { layoutOptions: { unitSize: 50 } }
        )
      );
      // 2 units × 50px
      expect(r.box('n1').x - right(r.box('n0'))).toBeCloseTo(100, 0);
    });

    it('supports a per-axis gap', async () => {
      const r = await run(
        config([
          {
            id: 'vpc',
            service: 'vpc',
            layout: {
              direction: 'LR',
              itemsPerLine: 2,
              gap: { horizontal: 0.4, vertical: 1 },
            },
          },
          ...items(4),
        ])
      );
      expect(r.box('n1').x - right(r.box('n0'))).toBeCloseTo(40, 0);
      expect(r.box('n2').y - bottom(r.box('n0'))).toBeCloseTo(100, 0);
    });

    it('inherits the global gap and lets a container override it', async () => {
      const r = await run(
        config(
          [
            { id: 'a', service: 'vpc' },
            { id: 'b', service: 'vpc', layout: { gap: 0.5 } },
            { id: 'a1', configuration: { vpc: 'a' } },
            { id: 'a2', configuration: { vpc: 'a' } },
            { id: 'b1', configuration: { vpc: 'b' } },
            { id: 'b2', configuration: { vpc: 'b' } },
          ],
          { layoutOptions: { gap: 1 } }
        )
      );
      const gapA = Math.abs(r.box('a2').y - r.box('a1').y) - r.box('a1').h;
      const gapB = Math.abs(r.box('b2').y - r.box('b1').y) - r.box('b1').h;
      expect(gapA).toBeCloseTo(100, 0);
      expect(gapB).toBeCloseTo(50, 0);
    });

    it('padding is local to the container; containerPadding is the default', async () => {
      const r = await run(
        config(
          [
            { id: 'a', service: 'vpc', layout: { padding: 0.5 } },
            { id: 'b', service: 'vpc' },
            { id: 'a1', configuration: { vpc: 'a' } },
            { id: 'b1', configuration: { vpc: 'b' } },
          ],
          { layoutOptions: { containerPadding: 1 } }
        )
      );
      expect(r.box('a1').x - r.box('a').x).toBeCloseTo(50, 0);
      expect(r.box('a1').y - r.box('a').y).toBeCloseTo(50, 0);
      expect(r.box('b1').x - r.box('b').x).toBeCloseTo(100, 0);
      expect(r.box('b1').y - r.box('b').y).toBeCloseTo(100, 0);
    });

    it('supports per-side padding', async () => {
      const r = await run(
        config([
          {
            id: 'a',
            service: 'vpc',
            layout: {
              padding: { top: 1, left: 0.5, right: 0.25, bottom: 0.25 },
            },
          },
          { id: 'a1', configuration: { vpc: 'a' } },
        ])
      );
      expect(r.box('a1').y - r.box('a').y).toBeCloseTo(100, 0);
      expect(r.box('a1').x - r.box('a').x).toBeCloseTo(50, 0);
    });

    it('the global direction sets the diagram flow', async () => {
      const cfg = config([{ id: 'a' }, { id: 'b' }], {
        layoutOptions: { direction: 'TB' },
        connections: [{ from: 'a', to: 'b' }],
      });
      const r = await run(cfg);
      expect(above(r.box('a'), r.box('b'))).toBe(true);

      const rl = await run(
        config([{ id: 'a' }, { id: 'b' }], {
          layoutOptions: { direction: 'RL' },
          connections: [{ from: 'a', to: 'b' }],
        })
      );
      expect(leftOf(rl.box('b'), rl.box('a'))).toBe(true);
    });
  });

  describe('container sizing', () => {
    it('minSize keeps a small container at a minimum footprint', async () => {
      const r = await run(
        config([
          {
            id: 'a',
            service: 'vpc',
            layout: { minSize: { width: 6, height: 4 } },
          },
          { id: 'a1', configuration: { vpc: 'a' } },
        ])
      );
      expect(r.box('a').w).toBeGreaterThanOrEqual(600);
      expect(r.box('a').h).toBeGreaterThanOrEqual(400);
    });

    it('minSize never shrinks a container below its content', async () => {
      const r = await run(
        config([
          {
            id: 'a',
            service: 'vpc',
            layout: { direction: 'LR', minSize: { width: 1 } },
          },
          ...['a1', 'a2', 'a3'].map((id) => ({
            id,
            configuration: { vpc: 'a' },
          })),
        ])
      );
      for (const id of ['a1', 'a2', 'a3']) {
        expect(inside(r.box(id), r.box('a'))).toBe(true);
      }
    });

    it('size fixes a leaf to the declared dimensions', async () => {
      const r = await run(
        config([{ id: 'big', layout: { size: { width: 2, height: 1.5 } } }])
      );
      expect(r.box('big').w).toBe(200);
      expect(r.box('big').h).toBe(150);
    });

    it('maxSize caps a leaf', async () => {
      const r = await run(
        config([{ id: 'leaf', layout: { maxSize: { width: 0.5 } } }])
      );
      expect(r.box('leaf').w).toBe(50);
    });

    it('warns when a container cannot honour its maxSize', async () => {
      const r = await run(
        config([
          {
            id: 'a',
            service: 'vpc',
            layout: { direction: 'LR', maxSize: { width: 1 } },
          },
          ...['a1', 'a2', 'a3'].map((id) => ({
            id,
            configuration: { vpc: 'a' },
          })),
        ])
      );
      expect(r.layoutWarnings.join('\n')).toMatch(/"a".*maxSize\.width/);
    });
  });

  describe('alignment and justification', () => {
    const row = (layout: AdacElementLayout): Svc[] => [
      {
        id: 'vpc',
        service: 'vpc',
        layout: { direction: 'LR', minSize: { width: 8 }, ...layout },
      },
      { id: 'small', ...inVpc, layout: { size: { height: 0.8 } } },
      { id: 'tall', ...inVpc, layout: { size: { height: 1.6 } } },
    ];

    it('align:center centres a lone line within a container wider than its content', async () => {
      const r = await run(
        config([
          {
            id: 'vpc',
            service: 'vpc',
            layout: {
              direction: 'TB',
              align: 'center',
              minSize: { width: 8 },
            },
          },
          { id: 'a', ...inVpc },
          { id: 'b', ...inVpc },
        ])
      );
      const vpc = r.box('vpc');
      for (const id of ['a', 'b']) {
        const b = r.box(id);
        expect(b.x - vpc.x).toBeCloseTo(right(vpc) - right(b), 0);
      }
    });

    it('align:center centres a single child in a container wider than it', async () => {
      const r = await run(
        config([
          {
            id: 'vpc',
            service: 'vpc',
            layout: {
              direction: 'TB',
              align: 'center',
              minSize: { width: 8 },
            },
          },
          { id: 'a', ...inVpc },
        ])
      );
      const vpc = r.box('vpc');
      const a = r.box('a');
      expect(a.x - vpc.x).toBeCloseTo(right(vpc) - right(a), 0);
    });

    it('a global align centres a top-level node on the boundary beside it', async () => {
      const cfg = config(
        [
          {
            id: 'vpc',
            service: 'vpc',
            layout: { minSize: { width: 4, height: 6 } },
          },
          { id: 'a', ...inVpc },
        ],
        {
          layoutOptions: { direction: 'LR', align: 'center' },
          connections: [{ from: 'user', to: 'vpc' }],
        }
      );
      cfg.applications = [
        { id: 'user', name: 'Users', type: 'user' },
      ] as AdacConfig['applications'];
      const r = await run(cfg);
      const user = r.box('user');
      const vpc = r.box('vpc');
      expect(user.y + 31).toBeCloseTo(vpc.y + vpc.h / 2, 0);
    });

    it('justify:start keeps children at the start', async () => {
      const r = await run(config(row({ justify: 'start' })));
      expect(r.box('small').x - r.box('vpc').x).toBeCloseTo(40, 0);
    });

    it('justify:end pushes children to the far side', async () => {
      const r = await run(config(row({ justify: 'end' })));
      const last = r.box('tall');
      expect(right(r.box('vpc')) - right(last)).toBeCloseTo(40, 0);
    });

    it('justify:center centres the line', async () => {
      const r = await run(config(row({ justify: 'center' })));
      const vpc = r.box('vpc');
      const first = r.box('small');
      const last = r.box('tall');
      expect(first.x - vpc.x).toBeCloseTo(right(vpc) - right(last), 0);
    });

    it('justify:space-between puts the first and last item at the edges', async () => {
      const r = await run(config(row({ justify: 'space-between' })));
      const vpc = r.box('vpc');
      expect(r.box('small').x - vpc.x).toBeCloseTo(40, 0);
      expect(right(vpc) - right(r.box('tall'))).toBeCloseTo(40, 0);
    });

    it('justify:space-around leaves equal space around each item', async () => {
      // no fixed gap, so the free space is shared out by justify alone
      const r = await run(config(row({ justify: 'space-around', gap: 0 })));
      const vpc = r.box('vpc');
      const a = r.box('small');
      const b = r.box('tall');
      const before = a.x - (vpc.x + 40);
      const between = b.x - right(a);
      const after = vpc.x + vpc.w - 40 - right(b);
      expect(before).toBeCloseTo(after, 0);
      expect(between).toBeGreaterThan(0);
      // each item gets half a share on both sides, so the space between two
      // items is twice the space before the first
      expect(between).toBeCloseTo(before * 2, 0);
    });

    it('align positions items across the main axis', async () => {
      const start = await run(config(row({ align: 'start' })));
      expect(start.box('small').y).toBeCloseTo(start.box('tall').y, 0);

      const end = await run(config(row({ align: 'end' })));
      expect(bottom(end.box('small'))).toBeCloseTo(bottom(end.box('tall')), 0);

      const center = await run(config(row({ align: 'center' })));
      const s = center.box('small');
      const t = center.box('tall');
      // leaf nodes are centred on their icon (31px below the top of the box)
      expect(s.y + 31).toBeCloseTo(t.y + 31, 0);
    });

    it('re-attaches edges to children that justification moved', async () => {
      const r = await run(
        config(row({ justify: 'space-between' }), {
          connections: [{ from: 'small', to: 'tall' }],
        })
      );
      const edge = r.edges.find((e) => e.id === 'c0')!;
      const a = r.box('small');
      const b = r.box('tall');
      const start = edge.points[0];
      const end = edge.points[edge.points.length - 1];
      expect(start.x).toBeGreaterThanOrEqual(a.x - 1);
      expect(start.x).toBeLessThanOrEqual(right(a) + 1);
      expect(end.x).toBeGreaterThanOrEqual(b.x - 1);
      expect(end.x).toBeLessThanOrEqual(right(b) + 1);
    });
  });

  describe('connection layout', () => {
    const pair = (layout: AdacConnection['layout']) =>
      config(
        [
          { id: 'a', service: 'lambda' },
          { id: 'b', service: 'lambda' },
        ],
        {
          layoutOptions: { direction: 'TB' },
          connections: [{ from: 'a', to: 'b', layout }],
        }
      );

    it('honours explicit fromSide / toSide', async () => {
      const r = await run(pair({ fromSide: 'right', toSide: 'left' }));
      const a = r.box('a');
      const b = r.box('b');
      const edge = r.edges.find((e) => e.id === 'c0')!;
      const start = edge.points[0];
      const end = edge.points[edge.points.length - 1];
      // edges start and end on the node box edges
      expect(start.x).toBeCloseTo(right(a), 0);
      expect(end.x).toBeCloseTo(b.x, 0);
    });

    it('creates no ports for auto sides', async () => {
      const g = await buildElkGraph(pair({ fromSide: 'auto', toSide: 'auto' }));
      expect(g.children!.every((c) => !c.ports?.length)).toBe(true);
      expect(g.edges![0].sources).toEqual(['a']);
    });

    it('passes bidirectional and per-connection routing to the renderer', async () => {
      const g = await buildElkGraph(
        config([{ id: 'a' }, { id: 'b' }], {
          connections: [
            {
              from: 'a',
              to: 'b',
              bidirectional: true,
              layout: { routing: 'straight' },
            },
          ],
        })
      );
      expect(g.edges![0].properties).toEqual({
        bidirectional: true,
        routing: 'straight',
      });
    });

    it('applies edgeRouting and edgeSpacing inside nested containers too', async () => {
      const g = await buildElkGraph(
        config(
          [
            { id: 'vpc', service: 'vpc' },
            { id: 'a', ...inVpc },
            { id: 'b', ...inVpc },
          ],
          {
            layoutOptions: { edgeRouting: 'polyline', edgeSpacing: 0.3 },
            connections: [{ from: 'a', to: 'b' }],
          }
        )
      );
      const find = (n: ElkNode, id: string): ElkNode | undefined =>
        n.id === id ? n : n.children?.map((c) => find(c, id)).find((x) => x);
      const vpc = find(g, 'vpc')!;
      expect(vpc.layoutOptions!['elk.edgeRouting']).toBe('POLYLINE');
      expect(
        vpc.layoutOptions!['elk.layered.spacing.edgeNodeBetweenLayers']
      ).toBe('30');
    });

    it('maps edgeRouting and edgeSpacing to engine constraints', async () => {
      const g = await buildElkGraph(
        config([{ id: 'a' }], {
          layoutOptions: { edgeRouting: 'splines', edgeSpacing: 0.5 },
        })
      );
      expect(g.layoutOptions!['elk.edgeRouting']).toBe('SPLINES');
      expect(
        g.layoutOptions!['elk.layered.spacing.edgeNodeBetweenLayers']
      ).toBe('50');
    });
  });

  describe('dense graphs', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `d${i}`);
    const connections = ids.flatMap((from, i) =>
      [1, 3, 5].map((step) => ({ from, to: ids[(i + step) % ids.length] }))
    );
    const dense = () =>
      config(
        [
          { id: 'vpc', service: 'vpc', layout: { itemsPerLine: 4 } },
          ...ids.map((id) => ({ id, ...inVpc })),
        ],
        { connections }
      );

    it('lays out many nodes and edges without overlap', async () => {
      const r = await run(dense());
      for (let i = 0; i < ids.length; i++) {
        expect(inside(r.box(ids[i]), r.box('vpc'))).toBe(true);
        for (let j = i + 1; j < ids.length; j++) {
          expect(overlaps(r.box(ids[i]), r.box(ids[j]))).toBe(false);
        }
      }
    });

    it('keeps wrapped lines stacked even when edges connect the lines', async () => {
      const r = await run(dense());
      // three rows of four, every row starting at the same x
      for (const row of [0, 1, 2]) {
        const first = r.box(`d${row * 4}`);
        for (let c = 1; c < 4; c++) {
          expect(sameRow(first, r.box(`d${row * 4 + c}`))).toBe(true);
        }
        if (row > 0) {
          expect(above(r.box(`d${(row - 1) * 4}`), first)).toBe(true);
        }
      }
    });

    it('still routes every connection', async () => {
      const r = await run(dense());
      expect(r.edges.length).toBe(connections.length);
      for (const edge of r.edges) {
        expect(edge.points.length).toBeGreaterThanOrEqual(2);
        for (const p of edge.points) {
          expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        }
      }
    });

    it('routes a connection between stacked lines between the middles of the facing borders', async () => {
      const r = await run(
        config(
          [
            { id: 'vpc', service: 'vpc', layout: { itemsPerLine: 2 } },
            ...items(3),
          ],
          { connections: [{ from: 'n0', to: 'n2' }] }
        )
      );
      const edge = r.edges.find((e) => e.id === 'c0')!;
      const first = edge.points[0];
      const last = edge.points[edge.points.length - 1];
      const n0 = r.box('n0');
      const n2 = r.box('n2');
      expect(first.x).toBeCloseTo(n0.x + n0.w / 2, 0);
      expect(first.y).toBeCloseTo(bottom(n0), 0);
      expect(last.x).toBeCloseTo(n2.x + n2.w / 2, 0);
      expect(last.y).toBeCloseTo(n2.y, 0);
      edge.points.slice(1).forEach((p, i) => {
        const q = edge.points[i];
        expect(Math.abs(p.x - q.x) < 0.5 || Math.abs(p.y - q.y) < 0.5).toBe(
          true
        );
      });
    });

    it('attaches deferred edges to the boxes they connect', async () => {
      const r = await run(dense());
      const touches = (p: { x: number; y: number }, b: Box) =>
        p.x >= b.x - 1 &&
        p.x <= right(b) + 1 &&
        p.y >= b.y - 1 &&
        p.y <= bottom(b) + 1;
      for (const [i, c] of connections.entries()) {
        const edge = r.edges.find((e) => e.id === `c${i}`)!;
        expect(touches(edge.points[0], r.box(c.from))).toBe(true);
        expect(touches(edge.points[edge.points.length - 1], r.box(c.to))).toBe(
          true
        );
      }
    });
  });

  describe('edge attachment', () => {
    const orthogonal = (pts: { x: number; y: number }[]) =>
      pts.every(
        (p, i) =>
          i === 0 ||
          Math.abs(p.x - pts[i - 1].x) < 0.5 ||
          Math.abs(p.y - pts[i - 1].y) < 0.5
      );

    it('attaches a lone edge at the icon of both facing nodes', async () => {
      const r = await run(
        config(
          [
            { id: 'n0', service: 'lambda' },
            { id: 'n1', service: 'lambda' },
          ],
          { connections: [{ from: 'n0', to: 'n1' }] }
        )
      );
      const edge = r.edges.find((e) => e.id === 'c0')!;
      const a = r.box('n0');
      const b = r.box('n1');
      const first = edge.points[0];
      const last = edge.points[edge.points.length - 1];
      expect(first.x).toBeCloseTo(right(a), 0);
      // the icon (42px, 10px below the top) is centred 31px below the top, not
      // at the middle of the box that also holds the caption
      expect(first.y).toBeCloseTo(a.y + 31, 0);
      expect(last.x).toBeCloseTo(b.x, 0);
      expect(last.y).toBeCloseTo(b.y + 31, 0);
      expect(orthogonal(edge.points)).toBe(true);
    });

    it('keeps edges that meet one side apart, inside the side', async () => {
      const r = await run(
        config([...items(4)], {
          connections: [
            { from: 'n0', to: 'n3' },
            { from: 'n1', to: 'n3' },
            { from: 'n2', to: 'n3' },
          ],
        })
      );
      const hub = r.box('n3');
      const ends = ['c0', 'c1', 'c2'].map((id) => {
        const pts = r.edges.find((e) => e.id === id)!.points;
        expect(orthogonal(pts)).toBe(true);
        return pts[pts.length - 1];
      });
      // all three arrive on the same side of the hub
      expect(new Set(ends.map((p) => Math.round(p.x))).size).toBe(1);
      const ys = ends.map((p) => p.y).sort((a, b) => a - b);
      expect(ys[0]).toBeGreaterThan(hub.y);
      expect(ys[2]).toBeLessThan(bottom(hub));
      expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(15.9);
      expect(ys[2] - ys[1]).toBeGreaterThanOrEqual(15.9);
    });

    it('starts edges at the middle of a container side', async () => {
      const r = await run(
        config(
          [
            { id: 'vpc', service: 'vpc' },
            { id: 'inner', ...inVpc },
            { id: 'out', service: 'ec2' },
          ],
          { connections: [{ from: 'vpc', to: 'out' }] }
        )
      );
      const edge = r.edges.find((e) => e.id === 'c0')!;
      const vpc = r.box('vpc');
      const first = edge.points[0];
      expect(first.x).toBeCloseTo(right(vpc), 0);
      expect(first.y).toBeCloseTo(vpc.y + vpc.h / 2, 0);
    });
  });

  describe('styling', () => {
    it('background defaults to false and can be set globally or per element', async () => {
      const find = (n: ElkNode, id: string): ElkNode | undefined =>
        n.id === id ? n : n.children?.map((c) => find(c, id)).find((x) => x);
      const bg = async (cfg: AdacConfig) => {
        const g = await buildElkGraph(cfg);
        return {
          a: find(g, 'a')!.properties?.background,
          b: find(g, 'b')!.properties?.background,
        };
      };
      expect(await bg(config([{ id: 'a' }, { id: 'b' }]))).toEqual({
        a: false,
        b: false,
      });
      expect(
        await bg(
          config([{ id: 'a' }, { id: 'b' }], {
            layoutOptions: { background: true },
          })
        )
      ).toEqual({ a: true, b: true });
      expect(
        await bg(
          config([{ id: 'a', background: true }, { id: 'b' }], {
            layoutOptions: { background: false },
          })
        )
      ).toEqual({ a: true, b: false });
      expect(
        await bg(
          config([{ id: 'a', background: false }, { id: 'b' }], {
            layoutOptions: { background: true },
          })
        )
      ).toEqual({ a: false, b: true });
    });

    it('edgeLabels draws each connection type on its edge unless disabled', async () => {
      const labels = async (layoutOptions?: AdacLayoutOptions) => {
        const out: (string | undefined)[] = [];
        const visit = (n: ElkNode) => {
          n.edges?.forEach((e) => out.push(e.labels?.[0]?.text));
          n.children?.forEach(visit);
        };
        visit(
          await buildElkGraph(
            config([{ id: 'a' }, { id: 'b' }], {
              layoutOptions,
              connections: [{ from: 'a', to: 'b', type: 'https' }],
            })
          )
        );
        return out;
      };
      expect(await labels()).toEqual(['https']);
      expect(await labels({ edgeLabels: true })).toEqual(['https']);
      expect(await labels({ edgeLabels: false })).toEqual([undefined]);
    });

    it('label line length is unset by default and can be set globally or per element', async () => {
      const find = (n: ElkNode, id: string): ElkNode | undefined =>
        n.id === id ? n : n.children?.map((c) => find(c, id)).find((x) => x);
      const chars = async (cfg: AdacConfig) => {
        const g = await buildElkGraph(cfg);
        return {
          a: find(g, 'a')!.properties?.labelMaxChars,
          b: find(g, 'b')!.properties?.labelMaxChars,
        };
      };
      expect(await chars(config([{ id: 'a' }, { id: 'b' }]))).toEqual({
        a: undefined,
        b: undefined,
      });
      expect(
        await chars(
          config([{ id: 'a' }, { id: 'b' }], {
            layoutOptions: { labelMaxChars: 20 },
          })
        )
      ).toEqual({ a: 20, b: 20 });
      expect(
        await chars(
          config([{ id: 'a', labelMaxChars: 30 }, { id: 'b' }], {
            layoutOptions: { labelMaxChars: 20 },
          })
        )
      ).toEqual({ a: 30, b: 20 });
    });
  });

  describe('deprecated aliases', () => {
    it('maps unit → unitSize and routing → edgeRouting with warnings', async () => {
      const warn = vi.fn();
      const g = await buildElkGraph(
        config(
          [
            { id: 'vpc', service: 'vpc', layout: { padding: 1 } },
            { id: 'v1', ...inVpc },
          ],
          { layoutOptions: { unit: 10, routing: 'splines' } }
        ),
        { onWarning: warn }
      );
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('unitSize'));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('edgeRouting'));
      expect(g.layoutOptions!['elk.edgeRouting']).toBe('SPLINES');
      const vpc = g.children!.find((c) => c.id === 'vpc')!;
      expect(vpc.layoutOptions!['elk.padding']).toBe(
        '[top=10,left=10,bottom=10,right=10]'
      );
    });
  });
});
