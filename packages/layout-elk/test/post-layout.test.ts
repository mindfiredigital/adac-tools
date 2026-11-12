import { describe, it, expect } from 'vitest';
import { applyLayoutPostProcessing } from '../src/post-layout.js';
import type { ElkNode } from '../src/types.js';

/**
 * A laid-out graph (as returned by ELK): an icon node `a` inside a container
 * with a 60px title band, linked side to side to an icon node `b` beside it.
 * ELK attaches the edge at the middle of both boxes (y + 45).
 */
function graph(aY: number, bY: number): ElkNode {
  return {
    id: 'root',
    x: 0,
    y: 0,
    width: 700,
    height: 400,
    children: [
      {
        id: 'vpc',
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        layoutOptions: { 'elk.padding': '[top=60,left=20,bottom=20,right=20]' },
        properties: { type: 'container' },
        children: [
          {
            id: 'a',
            x: 20,
            y: aY,
            width: 52,
            height: 90,
            properties: { type: 'service' },
          },
        ],
      },
      {
        id: 'b',
        x: 500,
        y: bY,
        width: 52,
        height: 90,
        properties: { type: 'service' },
      },
    ],
    edges: [
      {
        id: 'e',
        sources: ['a'],
        targets: ['b'],
        sections: [
          {
            id: 's',
            startPoint: { x: 72, y: aY + 45 },
            endPoint: { x: 500, y: bY + 45 },
          },
        ],
      },
    ],
  };
}

const child = (g: ElkNode, id: string) =>
  g.children![0].children!.find((c) => c.id === id)!;
const pointsOf = (g: ElkNode) => {
  const s = g.edges![0].sections![0];
  return [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
};

describe('straightening links between icon nodes', () => {
  it('keeps the edge attached when the node moves further than half its height', () => {
    // b's icon is 50px below a's: a moves down 50px, past ELK's end point
    const g = graph(100, 150);
    applyLayoutPostProcessing(g);
    const a = child(g, 'a');
    expect(a.y).toBe(150);
    const pts = pointsOf(g);
    expect(pts).toHaveLength(2);
    // starts on a's right side, at its icon, and runs straight to b's icon
    expect(pts[0]).toEqual({ x: 72, y: 150 + 31 });
    expect(pts[1]).toEqual({ x: 500, y: 150 + 31 });
  });

  it("never moves a node into its container's title band", () => {
    // b's icon is 50px above a's: a would have to move up to y=20
    const g = graph(70, 20);
    applyLayoutPostProcessing(g);
    const a = child(g, 'a');
    expect(a.y).toBe(70);
    // the edge still starts on a, at its icon
    const start = pointsOf(g)[0];
    expect(start.x).toBe(72);
    expect(start.y).toBeGreaterThanOrEqual(70 + 5);
    expect(start.y).toBeLessThanOrEqual(70 + 57);
  });
});

describe('straightening and a declared align', () => {
  // a row aligned to its bottom edge: a (80px) and b (120px) joined side to
  // side; moving one of them to line up the icons would undo the alignment
  const row = (align?: 'end'): ElkNode => ({
    id: 'root',
    x: 0,
    y: 0,
    width: 600,
    height: 400,
    children: [
      {
        id: 'row',
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        layoutOptions: { 'elk.padding': '[top=20,left=20,bottom=20,right=20]' },
        properties: {
          type: 'container',
          arrangement: {
            mainAxis: 'horizontal',
            align,
            padding: { top: 20, right: 20, bottom: 20, left: 20 },
          },
        } as never,
        children: [
          {
            id: 'a',
            x: 20,
            y: 20,
            width: 52,
            height: 80,
            properties: { type: 'service' },
          },
          {
            id: 'b',
            x: 200,
            y: 20,
            width: 52,
            height: 120,
            properties: { type: 'service' },
          },
        ],
        edges: [
          {
            id: 'e',
            sources: ['a'],
            targets: ['b'],
            container: 'row',
            sections: [
              {
                id: 's',
                startPoint: { x: 72, y: 50 },
                endPoint: { x: 200, y: 50 },
              },
            ],
          },
        ],
      },
    ],
  });
  const bottoms = (g: ElkNode) =>
    g.children![0].children!.map((n) => n.y! + n.height!);

  it('keeps the bottoms aligned for align: end', () => {
    const g = row('end');
    applyLayoutPostProcessing(g);
    expect(bottoms(g)).toEqual([140, 140]);
  });
});

describe('re-attaching edge ends to the icon', () => {
  // ELK leaves a collinear point at the end of each run; moving only the end
  // and the corner beside it used to leave a diagonal segment behind
  const graphWithCollinearRuns = (): ElkNode => ({
    id: 'root',
    x: 0,
    y: 0,
    width: 700,
    height: 500,
    children: [
      {
        id: 'wrap',
        x: 0,
        y: 0,
        width: 700,
        height: 500,
        properties: { type: 'container' },
        children: [
          {
            id: 'a',
            x: 20,
            y: 100,
            width: 52,
            height: 90,
            properties: { type: 'service' },
          },
          {
            id: 'b',
            x: 500,
            y: 300,
            width: 52,
            height: 90,
            properties: { type: 'service' },
          },
        ],
      },
    ],
    edges: [
      {
        id: 'e',
        sources: ['a'],
        targets: ['b'],
        sections: [
          {
            id: 's',
            startPoint: { x: 72, y: 145 },
            bendPoints: [
              { x: 150, y: 145 },
              { x: 300, y: 145 },
              { x: 300, y: 345 },
              { x: 400, y: 345 },
            ],
            endPoint: { x: 500, y: 345 },
          },
        ],
      },
    ],
  });

  it('keeps every segment horizontal or vertical', () => {
    const g = graphWithCollinearRuns();
    applyLayoutPostProcessing(g);
    const s = g.edges![0].sections![0];
    const pts = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
    pts.slice(1).forEach((p, i) => {
      const q = pts[i];
      expect(Math.abs(p.x - q.x) < 0.5 || Math.abs(p.y - q.y) < 0.5).toBe(true);
    });
    // both ends meet the icon (31px below the top of the box), not the box middle
    expect(pts[0]).toEqual({ x: 72, y: 100 + 31 });
    expect(pts[pts.length - 1]).toEqual({ x: 500, y: 300 + 31 });
  });
});

describe('keeping routes out of unrelated containers', () => {
  const graphWithObstacle = (): ElkNode => ({
    id: 'root',
    x: 0,
    y: 0,
    width: 800,
    height: 500,
    children: [
      {
        id: 'wrap',
        x: 0,
        y: 0,
        width: 800,
        height: 500,
        properties: { type: 'container' },
        children: [
          {
            id: 'a',
            x: 20,
            y: 100,
            width: 52,
            height: 90,
            properties: { type: 'service' },
          },
          {
            id: 'b',
            x: 600,
            y: 300,
            width: 52,
            height: 90,
            properties: { type: 'service' },
          },
          {
            id: 'other',
            x: 250,
            y: 180,
            width: 100,
            height: 140,
            properties: { type: 'container' },
            children: [],
          },
        ],
      },
    ],
    edges: [
      {
        id: 'e',
        sources: ['a'],
        targets: ['b'],
        sections: [
          {
            id: 's',
            startPoint: { x: 72, y: 131 },
            bendPoints: [
              { x: 300, y: 131 },
              { x: 300, y: 331 },
            ],
            endPoint: { x: 600, y: 331 },
          },
        ],
      },
    ],
  });

  it('moves the vertical run of a Z clear of a container it would cross', () => {
    const root = graphWithObstacle();
    applyLayoutPostProcessing(root);
    const s = root.edges![0].sections![0];
    const pts = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
    pts.slice(1).forEach((p, i) => {
      const q = pts[i];
      expect(Math.abs(p.x - q.x) < 0.5 || Math.abs(p.y - q.y) < 0.5).toBe(true);
    });
    const x = s.bendPoints![0].x;
    expect(x <= 250 - 8 || x >= 350 + 8).toBe(true);
  });

  it('leaves a route that crosses nothing alone', () => {
    const root = graphWithObstacle();
    const wrap = root.children![0];
    wrap.children = wrap.children!.filter((c) => c.id !== 'other');
    applyLayoutPostProcessing(root);
    expect(root.edges![0].sections![0].bendPoints![0].x).toBe(300);
  });
});

describe('a node standing on its own at the top level', () => {
  it('moves the whole way to line up with the node it links to', () => {
    const root: ElkNode = {
      id: 'root',
      x: 0,
      y: 0,
      width: 700,
      height: 500,
      children: [
        {
          id: 'a',
          x: 20,
          y: 100,
          width: 52,
          height: 90,
          properties: { type: 'service' },
        },
        {
          id: 'b',
          x: 500,
          y: 300,
          width: 52,
          height: 90,
          properties: { type: 'service' },
        },
      ],
      edges: [
        {
          id: 'e',
          sources: ['a'],
          targets: ['b'],
          sections: [
            {
              id: 's',
              startPoint: { x: 72, y: 131 },
              bendPoints: [
                { x: 300, y: 131 },
                { x: 300, y: 331 },
              ],
              endPoint: { x: 500, y: 331 },
            },
          ],
        },
      ],
    };
    applyLayoutPostProcessing(root);
    expect(root.children![0].y).toBe(300);
    const s = root.edges![0].sections![0];
    expect(s.startPoint.y).toBe(s.endPoint.y);
  });
});

describe('a route that has to cross a container', () => {
  it('bends in the gap nearest its target, not inside the container', () => {
    // `wall` spans the whole height between a and b, so the horizontal runs
    // cannot avoid it; the vertical run must still fall outside it
    const root: ElkNode = {
      id: 'root',
      x: 0,
      y: 0,
      width: 900,
      height: 500,
      children: [
        {
          id: 'wrap',
          x: 0,
          y: 0,
          width: 900,
          height: 500,
          properties: { type: 'container' },
          children: [
            {
              id: 'a',
              x: 20,
              y: 300,
              width: 52,
              height: 90,
              properties: { type: 'service' },
            },
            {
              id: 'b',
              x: 800,
              y: 100,
              width: 52,
              height: 90,
              properties: { type: 'service' },
            },
            {
              id: 'wall',
              x: 200,
              y: 20,
              width: 300,
              height: 460,
              properties: { type: 'container' },
              children: [],
            },
          ],
        },
      ],
      edges: [
        {
          id: 'e',
          sources: ['a'],
          targets: ['b'],
          sections: [
            {
              id: 's',
              startPoint: { x: 72, y: 331 },
              bendPoints: [
                { x: 300, y: 331 },
                { x: 300, y: 131 },
              ],
              endPoint: { x: 800, y: 131 },
            },
          ],
        },
      ],
    };
    applyLayoutPostProcessing(root);
    const x = root.edges![0].sections![0].bendPoints![0].x;
    expect(x >= 500 + 8).toBe(true);
    expect(x).toBeLessThan(800);
  });
});

describe('an edge that runs back against the flow', () => {
  it('is routed around the containers between its ends', () => {
    const wall = { x: 200, y: 300, w: 300, h: 160 };
    const root: ElkNode = {
      id: 'root',
      x: 0,
      y: 0,
      width: 900,
      height: 700,
      properties: {
        deferredEdges: [{ id: 'back', sources: ['nat'], targets: ['third'] }],
      },
      children: [
        {
          id: 'third',
          x: 20,
          y: 40,
          width: 140,
          height: 140,
          properties: { type: 'container' },
          children: [],
        },
        {
          id: 'wall',
          x: wall.x,
          y: wall.y,
          width: wall.w,
          height: wall.h,
          properties: { type: 'container' },
          children: [],
        },
        {
          id: 'nat',
          x: 700,
          y: 330,
          width: 52,
          height: 90,
          properties: { type: 'service' },
        },
      ],
    };
    applyLayoutPostProcessing(root);
    const edge = root.edges!.find((e) => e.id === 'back')!;
    const s = edge.sections![0];
    const pts = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
    pts.slice(1).forEach((p, i) => {
      const q = pts[i];
      expect(Math.abs(p.x - q.x) < 0.5 || Math.abs(p.y - q.y) < 0.5).toBe(true);
      const crosses =
        Math.max(p.x, q.x) > wall.x &&
        Math.min(p.x, q.x) < wall.x + wall.w &&
        Math.max(p.y, q.y) > wall.y &&
        Math.min(p.y, q.y) < wall.y + wall.h;
      expect(crosses).toBe(false);
    });
    // leaves the node on its left side and enters the box from below
    expect(s.startPoint.x).toBeLessThanOrEqual(700 + 1);
    expect(s.endPoint.y).toBe(180);
  });
});

describe('an edge that asks for the top of a node', () => {
  it('leaves the top edge and joins the old route at its first corner', () => {
    const root: ElkNode = {
      id: 'root',
      x: 0,
      y: 0,
      width: 700,
      height: 500,
      children: [
        {
          id: 'wrap',
          x: 0,
          y: 0,
          width: 700,
          height: 500,
          properties: { type: 'container' },
          children: [
            {
              id: 'a',
              x: 20,
              y: 300,
              width: 52,
              height: 90,
              properties: { type: 'service' },
            },
            {
              id: 'b',
              x: 600,
              y: 100,
              width: 52,
              height: 90,
              properties: { type: 'service' },
            },
          ],
        },
      ],
      edges: [
        {
          id: 'e',
          sources: ['a'],
          targets: ['b'],
          properties: { sideHintSource: 'N' },
          sections: [
            {
              id: 's',
              startPoint: { x: 72, y: 331 },
              bendPoints: [
                { x: 300, y: 331 },
                { x: 300, y: 131 },
              ],
              endPoint: { x: 600, y: 131 },
            },
          ],
        },
      ],
    };
    applyLayoutPostProcessing(root);
    const s = root.edges![0].sections![0];
    const pts = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
    // the end sits on the icon at the top of the box, not inside the caption
    expect(s.startPoint.y).toBeGreaterThanOrEqual(300);
    expect(s.startPoint.y).toBeLessThan(320);
    pts.slice(1).forEach((p, i) => {
      const q = pts[i];
      expect(Math.abs(p.x - q.x) < 0.5 || Math.abs(p.y - q.y) < 0.5).toBe(true);
    });
    expect(pts[1].y).toBeLessThan(s.startPoint.y);
  });
});

describe('edges that share a run', () => {
  it('moves one of two inner runs on the same line apart', () => {
    const edge = (
      id: string,
      from: string,
      to: string,
      y0: number,
      y1: number
    ) => ({
      id,
      sources: [from],
      targets: [to],
      sections: [
        {
          id: `${id}_s`,
          startPoint: { x: 72, y: y0 },
          bendPoints: [
            { x: 300, y: y0 },
            { x: 300, y: y1 },
          ],
          endPoint: { x: 600, y: y1 },
        },
      ],
    });
    const node = (id: string, x: number, y: number) => ({
      id,
      x,
      y,
      width: 52,
      height: 90,
      properties: { type: 'service' },
    });
    const root: ElkNode = {
      id: 'root',
      x: 0,
      y: 0,
      width: 700,
      height: 600,
      children: [
        {
          id: 'wrap',
          x: 0,
          y: 0,
          width: 700,
          height: 600,
          properties: { type: 'container' },
          children: [
            node('a', 20, 400),
            node('c', 20, 500),
            node('b', 600, 100),
            node('d', 600, 200),
          ],
        },
      ],
      edges: [edge('e1', 'a', 'b', 431, 131), edge('e2', 'c', 'd', 531, 231)],
    };
    applyLayoutPostProcessing(root);
    const x = (i: number) => root.edges![i].sections![0].bendPoints![0].x;
    expect(Math.abs(x(0) - x(1))).toBeGreaterThanOrEqual(8);
  });
});
