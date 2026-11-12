import { describe, it, expect } from 'vitest';
import {
  drawnPoints,
  renderSvg,
  separateOpposingEdges,
} from '../src/renderer.js';
import { generateDiagramSvg } from '../src/generator.js';
import { type ElkEdge, type ElkNode } from '@mindfiredigital/adac-layout-elk';
import fs from 'fs';
import path from 'path';

const leaf = (
  id: string,
  properties: Record<string, unknown> = {}
): ElkNode => ({
  id,
  width: 100,
  height: 100,
  labels: [{ text: id }],
  properties: { type: 'service', ...properties },
});

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** First rect drawn for a node (its card or container frame). */
function nodeRect(svg: string, id: string): Rect {
  const m = new RegExp(
    `<g id="node-${id}">(?:<title>[\\s\\S]*?</title>)?\\s*<rect x="([\\d.-]+)" y="([\\d.-]+)"\\s+width="([\\d.-]+)" height="([\\d.-]+)"`
  ).exec(svg);
  if (!m) throw new Error(`no rect for ${id}`);
  return { x: +m[1], y: +m[2], w: +m[3], h: +m[4] };
}

describe('renderer: node background', () => {
  const graph = (background?: boolean): ElkNode => ({
    id: 'root',
    children: [leaf('a', background === undefined ? {} : { background })],
  });

  it('draws no card or icon pill by default', async () => {
    const svg = await renderSvg(graph());
    expect(svg).toContain('class="node-card node-card-plain"');
    expect(svg).not.toMatch(/class="node-card"/);
  });

  it('restores the legacy card when background is true', async () => {
    const svg = await renderSvg(graph(true));
    expect(svg).toMatch(/class="node-card"/);
    expect(svg).not.toContain('node-card-plain"/>');
  });

  it('keeps the plain card hit-testable so tooltips still work', async () => {
    const svg = await renderSvg(graph());
    expect(svg).toMatch(/\.node-card-plain\s*\{[^}]*pointer-events:\s*all/);
    expect(svg).toMatch(/\.node-card-plain\s*\{[^}]*fill:\s*transparent/);
  });

  it('applies per node, not per diagram', async () => {
    const svg = await renderSvg({
      id: 'root',
      children: [leaf('on', { background: true }), leaf('off')],
    });
    expect(svg).toMatch(/id="node-on">\s*<rect[^>]*class="node-card"/);
    expect(svg).toMatch(
      /id="node-off">\s*<rect[^>]*class="node-card node-card-plain"/
    );
  });
});

describe('renderer: layout artifacts', () => {
  it('never draws layout-only edges', async () => {
    const svg = await renderSvg({
      id: 'root',
      children: [leaf('a'), leaf('b')],
      edges: [
        {
          id: '__adac_layout__a->b',
          sources: ['a'],
          targets: ['b'],
          properties: { layoutOnly: true },
        },
        { id: 'real', sources: ['a'], targets: ['b'] },
      ],
    });
    expect(svg.match(/class="aws-edge"/g)?.length).toBe(1);
  });

  it('renders the children of an invisible line group, not the group', async () => {
    const svg = await renderSvg({
      id: 'root',
      children: [
        {
          id: 'box',
          properties: { type: 'container', cssClass: 'aws-vpc' },
          children: [
            {
              id: 'box__line0',
              properties: { type: 'layout-line' },
              children: [leaf('a'), leaf('b')],
            },
          ],
        },
      ],
    });
    expect(svg).toContain('id="node-a"');
    expect(svg).toContain('id="node-b"');
    expect(svg).not.toContain('box__line0');
  });
});

describe('renderer: edges', () => {
  const pair = (properties?: ElkNode['properties'] | Record<string, unknown>) =>
    renderSvg({
      id: 'root',
      children: [leaf('a'), leaf('b')],
      edges: [
        {
          id: 'e',
          sources: ['a'],
          targets: ['b'],
          ...(properties ? { properties } : {}),
        } as never,
      ],
    });

  it('draws an arrowhead at both ends for bidirectional connections', async () => {
    const svg = await pair({ bidirectional: true });
    expect(svg).toMatch(
      /marker-start="url\(#arrow\)"\s+marker-end="url\(#arrow\)"/
    );
  });

  it('draws one arrowhead for ordinary connections', async () => {
    const svg = await pair();
    expect(svg).not.toContain('marker-start');
    expect(svg).toContain('marker-end');
  });

  it('draws a straight line for routing: straight', async () => {
    const svg = await pair({ routing: 'straight' });
    const d = /<path d="([^"]+)" class="aws-edge"/.exec(svg)![1];
    expect(d.match(/ L /g)?.length).toBe(1);
  });
});

describe('renderer: custom engine ignores ELK-only structure', () => {
  it('resolves port references and drops layout-only edges', async () => {
    const svg = await renderSvg(
      {
        id: 'root',
        children: [
          { ...leaf('a'), ports: [{ id: 'a__e__out' }] },
          { ...leaf('b'), ports: [{ id: 'b__e__in' }] },
        ],
        edges: [
          { id: 'e', sources: ['a__e__out'], targets: ['b__e__in'] },
          {
            id: '__adac_layout__x',
            sources: ['a'],
            targets: ['b'],
            properties: { layoutOnly: true },
          },
        ],
      },
      'custom'
    );
    expect(svg.match(/class="aws-edge"/g)?.length).toBe(1);
  });
});

describe('end to end: YAML → SVG', () => {
  const yaml = (extra: string, services = '', connections = '') => `
version: "0.2"
metadata:
  name: "Layout"
  created: "2026-01-01"
${extra}
infrastructure:
  clouds:
    - id: "aws-1"
      provider: "aws"
      region: "us-east-1"
      services:
        - id: "vpc"
          service: "vpc"
          name: "VPC"
          visual:
            layout:
              direction: TB
        - id: "public"
          service: "subnet"
          name: "Public"
          configuration: { vpc: "vpc" }
        - id: "private"
          service: "subnet"
          name: "Private"
          configuration: { vpc: "vpc" }
          visual:
            layout:
              direction: LR
        - id: "ecs"
          service: "ec2"
          name: "ECS"
          configuration: { subnets: ["private"] }
        - id: "db"
          service: "rds-postgres"
          name: "DB"
          configuration: { subnets: ["private"] }
${services}
${connections}
`;

  it('renders the declared structure', async () => {
    const { svg } = await generateDiagramSvg(yaml(''), undefined, true);
    const pub = nodeRect(svg, 'public');
    const priv = nodeRect(svg, 'private');
    const ecs = nodeRect(svg, 'ecs');
    const db = nodeRect(svg, 'db');
    const vpc = nodeRect(svg, 'vpc');

    // Private Subnet is below Public Subnet
    expect(pub.y + pub.h).toBeLessThanOrEqual(priv.y + 0.5);
    // ECS is left of DB, both inside the Private Subnet
    expect(ecs.x + ecs.w).toBeLessThanOrEqual(db.x + 0.5);
    for (const r of [ecs, db]) {
      expect(r.x).toBeGreaterThanOrEqual(priv.x);
      expect(r.x + r.w).toBeLessThanOrEqual(priv.x + priv.w + 0.5);
    }
    expect(priv.x + priv.w).toBeLessThanOrEqual(vpc.x + vpc.w + 0.5);
  });

  it('is deterministic', async () => {
    const a = await generateDiagramSvg(yaml(''), undefined, true);
    const b = await generateDiagramSvg(yaml(''), undefined, true);
    expect(a.svg).toBe(b.svg);
  });

  it('flows right-to-left when the global direction asks for it', async () => {
    const { svg } = await generateDiagramSvg(
      yaml(
        'layoutOptions:\n  direction: RL',
        '',
        `connections:
  - id: c1
    from: ecs
    to: db
    type: database-query`
      ),
      undefined,
      true
    );
    // within the (LR) private subnet the declared direction still wins
    expect(nodeRect(svg, 'ecs').x).toBeLessThan(nodeRect(svg, 'db').x);
  });

  it('applies the global background default and per-element override', async () => {
    const GLOBAL_BG = ['layoutOptions:', '  background: true'].join('\n');
    const card = /<rect[^>]*class="node-card"/;
    const plain = /<rect[^>]*class="node-card node-card-plain"/;
    const node = (svg: string, id: string) =>
      new RegExp(
        `id="node-${id}">(?:<title>[\\s\\S]*?</title>)?\\s*(<rect[^>]*>)`
      ).exec(svg)![1];

    const defaults = await generateDiagramSvg(yaml(''), undefined, true);
    expect(node(defaults.svg, 'db')).toMatch(plain);

    const global = await generateDiagramSvg(yaml(GLOBAL_BG), undefined, true);
    expect(node(global.svg, 'db')).toMatch(card);

    const extra = `        - id: "cards"
          service: "dynamodb"
          name: "Cards"
          configuration: { subnets: ["private"] }
          visual:
            style:
              background: true`;
    const mixed = await generateDiagramSvg(yaml('', extra), undefined, true);
    expect(node(mixed.svg, 'cards')).toMatch(card);
    expect(node(mixed.svg, 'db')).toMatch(plain);

    const overridden = await generateDiagramSvg(
      yaml(GLOBAL_BG, extra.replace('true', 'false')),
      undefined,
      true
    );
    expect(node(overridden.svg, 'cards')).toMatch(plain);
    expect(node(overridden.svg, 'db')).toMatch(card);
  });

  it('reports deprecated aliases in the generation log', async () => {
    const { logs } = await generateDiagramSvg(
      yaml('layoutOptions:\n  unit: 100'),
      undefined,
      true
    );
    expect(logs.join('\n')).toMatch(/layoutOptions\/unit is deprecated/);
  });

  it('rejects invalid layout declarations when validating', async () => {
    await expect(
      generateDiagramSvg(
        yaml('layoutOptions:\n  direction: sideways'),
        undefined,
        true
      )
    ).rejects.toThrow(/Schema validation failed/);
  });

  it('renders the same hierarchy with every engine', async () => {
    for (const engine of ['elk', 'custom', 'orthogonal', 'tsm'] as const) {
      const { svg } = await generateDiagramSvg(
        yaml(
          '',
          '',
          `connections:
  - id: c1
    from: ecs
    to: db
    type: database-query
    bidirectional: true
    layout:
      fromSide: right
      toSide: left`
        ),
        engine,
        true
      );
      for (const id of ['vpc', 'public', 'private', 'ecs', 'db']) {
        expect(svg, `${engine}: ${id}`).toContain(`id="node-${id}"`);
      }
    }
  });
});

describe('renderer: edges inside nested containers', () => {
  // Edges routed between children of nested containers are stored relative to
  // that container; they must land on the node borders, not be offset by the
  // canvas padding a second time.
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    },
    children: [
      leaf('user'),
      {
        id: 'outer',
        properties: { type: 'container', cssClass: 'aws-cloud' },
        layoutOptions: { 'elk.padding': '[top=60,left=40,bottom=40,right=40]' },
        children: [
          leaf('gate'),
          {
            id: 'cluster',
            properties: { type: 'container', cssClass: 'aws-compute-cluster' },
            layoutOptions: {
              'elk.padding': '[top=60,left=40,bottom=40,right=40]',
            },
            children: [leaf('svc')],
          },
        ],
      },
    ],
    edges: [
      { id: 'e1', sources: ['user'], targets: ['gate'] },
      { id: 'e2', sources: ['gate'], targets: ['cluster'] },
    ],
  };

  const endpoints = (svg: string) =>
    [...svg.matchAll(/<path d="(M [^"]+)" class="aws-edge"/g)].map((m) => {
      const nums = m[1].match(/-?[\d.]+/g)!.map(Number);
      return {
        start: { x: nums[0], y: nums[1] },
        end: { x: nums[nums.length - 2], y: nums[nums.length - 1] },
      };
    });

  it('ends a nested edge on the border of its target container', async () => {
    const svg = await renderSvg(graph);
    const gate = nodeRect(svg, 'gate');
    const cluster = nodeRect(svg, 'cluster');
    const [, e2] = endpoints(svg);

    expect(e2.start.x).toBeCloseTo(gate.x + gate.w, 0);
    expect(e2.end.x).toBeCloseTo(cluster.x, 0);
    expect(e2.end.y).toBeGreaterThanOrEqual(cluster.y);
    expect(e2.end.y).toBeLessThanOrEqual(cluster.y + cluster.h);
  });

  it('keeps edges attached however far the canvas is shifted', async () => {
    // A root-level node far from the origin changes the padding shift.
    const shifted: ElkNode = {
      ...graph,
      children: [{ ...leaf('far'), x: -300, y: -200 }, ...graph.children!],
    };
    const svg = await renderSvg(shifted);
    const cluster = nodeRect(svg, 'cluster');
    const [, e2] = endpoints(svg);
    expect(e2.end.x).toBeCloseTo(cluster.x, 0);
  });
});

describe('renderer: edge labels', () => {
  const overlaps = (a: Rect, b: Rect) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  const rects = (svg: string, pattern: RegExp): Rect[] =>
    [...svg.matchAll(pattern)].map((m) => ({
      x: +m[1],
      y: +m[2],
      w: +m[3],
      h: +m[4],
    }));

  it('never draws a label on top of a node or another label', async () => {
    const yamlText = fs
      .readFileSync(
        path.resolve(
          __dirname,
          '../../../yamls/aws_ecs_microservices_layout.adac.yaml'
        ),
        'utf8'
      )
      // labels need room: the shipped file packs boxes tightly and has no labels
      .replace('edgeLabels: false', 'edgeLabels: true')
      .replace(/gap: 0\.(15|2|3)(?!\d)/g, 'gap: 0.6');
    const { svg } = await generateDiagramSvg(yamlText, 'elk');

    const labels = rects(
      svg,
      /<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)" rx="2" fill="white" fill-opacity="0.85"\/>/g
    );
    const cards = rects(
      svg,
      /<rect x="([\d.-]+)" y="([\d.-]+)"\s+width="([\d.-]+)" height="([\d.-]+)"\s+class="node-card/g
    );
    expect(labels.length).toBe(11);
    expect(cards.length).toBeGreaterThan(5);

    for (const label of labels) {
      for (const card of cards) expect(overlaps(label, card)).toBe(false);
    }
    labels.forEach((a, i) =>
      labels.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false))
    );
  });

  it('draws no edge labels when edgeLabels is false', async () => {
    const yamlText = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../yamls/aws_ecs_microservices_layout.adac.yaml'
      ),
      'utf8'
    );
    const { svg } = await generateDiagramSvg(yamlText, 'elk');
    expect(svg).not.toContain('class="edge-label"');
  });

  it('limits characters on a label line with labelMaxChars', async () => {
    const long = 'abcdefghijklmnopqrstuvwxyz';
    const text = async (properties: Record<string, unknown>) =>
      (
        await renderSvg({
          id: 'root',
          children: [leaf(long, properties)],
        })
      ).includes(`>${long}</text>`);
    const svg = await renderSvg({
      id: 'root',
      children: [leaf(long, { labelMaxChars: 10 })],
    });
    expect(svg).toContain('>abcdefghij…</text>');
    // unset: truncated to what fits the caption, not to 10
    expect(
      await renderSvg({ id: 'root', children: [leaf(long)] })
    ).not.toContain('>abcdefghij…</text>');
    // long enough: shown in full
    expect(await text({ labelMaxChars: 40 })).toBe(true);
  });

  it('truncates a short label only when it exceeds labelMaxChars by more than 2', async () => {
    const labelOf = async (properties: Record<string, unknown>) => {
      const svg = await renderSvg({
        id: 'root',
        children: [
          { ...leaf('redis', properties), labels: [{ text: 'Redis' }] },
        ],
      });
      // the "?" is the placeholder drawn when a node has no icon
      return [
        ...svg
          .slice(svg.indexOf('id="node-redis"'))
          .matchAll(/aws-node-label"[^>]*>([^<]*)</g),
      ]
        .map((m) => m[1])
        .find((t) => t !== '?');
    };
    expect(await labelOf({})).toBe('Redis');
    expect(await labelOf({ labelMaxChars: 8 })).toBe('Redis');
    // 5 characters are within a limit of 3 plus the 2 character allowance
    expect(await labelOf({ labelMaxChars: 3 })).toBe('Redis');
    expect(await labelOf({ labelMaxChars: 2 })).toBe('Re…');
  });

  describe('links in the ECS microservices diagram', () => {
    type Pt = { x: number; y: number };
    const paths = (svg: string): Pt[][] =>
      [...svg.matchAll(/<path[^>]*\sd="(M [^"]*)"/g)].map((m) =>
        [...m[1].matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((p) => ({
          x: +p[1],
          y: +p[2],
        }))
      );
    const render = async () =>
      (
        await generateDiagramSvg(
          fs.readFileSync(
            path.resolve(
              __dirname,
              '../../../yamls/aws_ecs_microservices_layout.adac.yaml'
            ),
            'utf8'
          ),
          'elk'
        )
      ).svg;

    // the icon is centred 31px below the top of a 52px wide node box
    const iconCentre = (b: Rect) => ({ x: b.x + b.w / 2, y: b.y + 31 });

    it('links Users to Edge Layer and Edge Layer to the ALB with straight lines', async () => {
      const svg = await render();
      const users = nodeRect(svg, 'users');
      const alb = nodeRect(svg, 'alb');
      // Users is moved so its icon centre is level with the Edge Layer's middle
      const edgeLayer = nodeRect(svg, 'edge-layer');
      expect(users.y + 31).toBeCloseTo(edgeLayer.y + edgeLayer.h / 2, 0);
      const fromUsers = paths(svg).find(
        (p) => Math.abs(p[0].x - (users.x + users.w)) < 1
      )!;
      const intoAlb = paths(svg).find(
        (p) => Math.abs(p[p.length - 1].x - alb.x) < 1
      )!;
      for (const line of [fromUsers, intoAlb]) {
        expect(line).toHaveLength(2);
        expect(line[0].y).toBeCloseTo(line[1].y, 1);
      }
    });

    it('attaches the CloudWatch and Secrets Manager arrows at the icon centre', async () => {
      const svg = await render();
      const cw = nodeRect(svg, 'cloudwatch');
      const sm = nodeRect(svg, 'secrets-manager');
      const intoCloudwatch = paths(svg).find((p) => {
        const end = p[p.length - 1];
        return Math.abs(end.x - (cw.x + cw.w)) < 1;
      })!;
      expect(intoCloudwatch[intoCloudwatch.length - 1].y).toBeCloseTo(
        iconCentre(cw).y,
        1
      );
      const fromSecrets = paths(svg).find(
        (p) =>
          Math.abs(p[0].x - iconCentre(sm).x) < 1 &&
          Math.abs(p[0].y - (sm.y + 57)) < 1
      );
      expect(fromSecrets).toBeDefined();
    });
  });

  it('escapes label text', async () => {
    const svg = await renderSvg({
      id: 'root',
      children: [leaf('a'), leaf('b')],
      edges: [
        {
          id: 'e',
          sources: ['a'],
          targets: ['b'],
          labels: [{ text: 'a<b&c' }],
        },
      ],
    });
    expect(svg).toContain('a&lt;b&amp;c');
  });
});

describe('renderer: per-connection routing', () => {
  const section = (...pts: [number, number][]) => ({
    id: 's',
    startPoint: { x: pts[0][0], y: pts[0][1] },
    endPoint: { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] },
    bendPoints: pts.slice(1, -1).map(([x, y]) => ({ x, y })),
  });

  it('draws an orthogonal override of a sloped route with right angles', () => {
    expect(drawnPoints(section([0, 0], [100, 50]), 'orthogonal')).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ]);
  });

  it('draws a polyline override of an orthogonal route with slanted segments', () => {
    expect(
      drawnPoints(section([0, 0], [50, 0], [50, 50], [100, 50]), 'polyline')
    ).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 25 },
      { x: 100, y: 50 },
    ]);
  });

  it('reports the line actually drawn for straight edges', () => {
    expect(
      drawnPoints(section([0, 0], [50, 0], [50, 50], [100, 50]), 'straight')
    ).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ]);
  });

  it('follows the drawn curve for splines', () => {
    const pts = drawnPoints(
      section([0, 0], [50, 0], [50, 50], [100, 50]),
      'splines'
    );
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 100, y: 50 });
    // the curve never passes through the sharp corner at (50, 0)
    expect(pts).not.toContainEqual({ x: 50, y: 0 });
  });
});

describe('renderer: opposing connections', () => {
  const edge = (
    id: string,
    from: string,
    to: string,
    pts: [number, number][]
  ): ElkEdge => ({
    id,
    sources: [from],
    targets: [to],
    sections: [
      {
        id: `${id}-s`,
        startPoint: { x: pts[0][0], y: pts[0][1] },
        endPoint: { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] },
        bendPoints: pts.slice(1, -1).map(([x, y]) => ({ x, y })),
      },
    ],
  });
  const ends = (e: ElkEdge) => {
    const s = e.sections![0];
    return [s.startPoint, s.endPoint];
  };

  it('leaves opposing edges alone when they are already apart', () => {
    const ab = edge('ab', 'a', 'b', [
      [100, 40],
      [200, 40],
    ]);
    const ba = edge('ba', 'b', 'a', [
      [200, 70],
      [100, 70],
    ]);
    separateOpposingEdges([ab, ba], (r) => r);
    expect(ends(ab)).toEqual([
      { x: 100, y: 40 },
      { x: 200, y: 40 },
    ]);
    expect(ends(ba)).toEqual([
      { x: 200, y: 70 },
      { x: 100, y: 70 },
    ]);
  });

  it('slides overlapping edges apart along the sides they meet', () => {
    const ab = edge('ab', 'a', 'b', [
      [100, 40],
      [200, 40],
    ]);
    const ba = edge('ba', 'b', 'a', [
      [200, 40],
      [100, 40],
    ]);
    separateOpposingEdges([ab, ba], (r) => r);
    // x stays on the node borders; only y moves
    expect(ends(ab)).toEqual([
      { x: 100, y: 44 },
      { x: 200, y: 44 },
    ]);
    expect(ends(ba)).toEqual([
      { x: 200, y: 36 },
      { x: 100, y: 36 },
    ]);
  });
});
