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
