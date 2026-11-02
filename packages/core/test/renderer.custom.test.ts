import { describe, it, expect, vi } from 'vitest';
import { renderSvg } from '../src/renderer.js';
import { type ElkNode } from '@mindfiredigital/adac-layout-elk';
import fs from 'fs-extra';

describe('Custom Layout Engine (Renderer)', () => {
  it('should layout nodes in a grid when edges are missing', async () => {
    const graph: ElkNode = {
      id: 'root',
      children: [
        { id: 'n1', width: 100, height: 100, properties: { type: 'service' } },
        { id: 'n2', width: 100, height: 100, properties: { type: 'service' } },
        { id: 'n3', width: 100, height: 100, properties: { type: 'service' } },
        { id: 'n4', width: 100, height: 100, properties: { type: 'service' } },
        { id: 'n5', width: 100, height: 100, properties: { type: 'service' } },
      ],
    };

    const svg = await renderSvg(graph, 'custom');
    expect(svg).toContain('id="node-n1"');
    expect(svg).toContain('id="node-n5"');

    const nodeY = (id: string) => {
      const nodeGroup = svg.match(
        new RegExp(`<g id="node-${id}">([\\s\\S]*?)</g>`)
      );
      expect(nodeGroup, `Missing SVG group for node ${id}`).toBeTruthy();

      const rectByClass = (className: string) =>
        nodeGroup![1].match(
          new RegExp(
            `<rect\\b(?=[^>]*\\bclass\\s*=\\s*["'][^"']*\\b${className}\\b[^"']*["'])[^>]*?>`
          )
        )?.[0];
      const mainRect =
        rectByClass('node-card') ||
        rectByClass('aws-container') ||
        rectByClass('gcp-container') ||
        rectByClass('azure-container') ||
        nodeGroup![1].match(/<rect\b[^>]*?>/)?.[0];
      const yMatch = mainRect?.match(/\by\s*=\s*["']([^"']+)["']/);

      expect(yMatch, `Missing main rect y for node ${id}`).toBeTruthy();
      const y = Number(yMatch![1]);
      expect(
        Number.isFinite(y),
        `Invalid Y coordinate for node ${id}: ${yMatch![1]}`
      ).toBe(true);
      return y;
    };

    expect(
      nodeY('n5'),
      'Expected n5 to be placed below n1 in fallback grid layout'
    ).toBeGreaterThan(nodeY('n1'));
  });

  it('should use core engine for ranked layout when edges exist', async () => {
    const graph: ElkNode = {
      id: 'root',
      children: [
        {
          id: 'n1',
          width: 100,
          height: 100,
          properties: { type: 'service', isStacked: true, cost: 45.5 },
        },
        {
          id: 'n2',
          width: 100,
          height: 100,
          properties: { type: 'service', isStacked: false, cost: 0 },
        },
      ],
      edges: [{ id: 'e1', sources: ['n1'], targets: ['n2'] }],
    };

    const costData = { n1: 45.5, n2: 0 };
    const svg = await renderSvg(
      graph,
      'custom',
      undefined,
      undefined,
      costData
    );
    expect(svg).toContain('class="aws-edge"');
    // Check that nodes are placed (coordinates depend on core engine, but should exist)
    expect(svg).toContain('id="node-n1"');
    expect(svg).toContain('id="node-n2"');
    // Check stacked and cost logic
    expect(svg).toContain('rx="10" ry="10" fill-opacity="0.4"');
    expect(svg).toContain('$45.50');
    expect(svg).toContain('$0.00');
  });

  it('should handle recursive container layouts', async () => {
    const graph: ElkNode = {
      id: 'root',
      children: [
        {
          id: 'c1',
          properties: { type: 'container', cssClass: 'aws-vpc' },
          children: [
            {
              id: 'n1',
              width: 100,
              height: 100,
              properties: { type: 'service' },
            },
          ],
        },
      ],
    };

    const svg = await renderSvg(graph, 'custom');
    expect(svg).toContain('aws-vpc');
    expect(svg).toContain('id="node-n1"');
  });

  it('should perform orthogonal routing for cross-container edges', async () => {
    const graph: ElkNode = {
      id: 'root',
      children: [
        {
          id: 'c1',
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          properties: { type: 'container', cssClass: 'aws-vpc' },
          children: [{ id: 'n1', width: 100, height: 100, x: 50, y: 50 }],
        },
        {
          id: 'c2',
          x: 400,
          y: 0,
          width: 200,
          height: 200,
          properties: { type: 'container', cssClass: 'aws-vpc' },
          children: [{ id: 'n2', width: 100, height: 100, x: 50, y: 50 }],
        },
      ],
      edges: [{ id: 'e1', sources: ['n1'], targets: ['n2'] }],
    };

    const svg = await renderSvg(graph, 'custom');
    // Should contain a path with at least one bend point for orthogonal routing
    // midX = (srcCx + tgtCx) / 2 = ((0+50+50) + (400+50+50)) / 2 = (100 + 500) / 2 = 300
    expect(svg).toContain('L');
    expect(svg.split('L').length).toBeGreaterThan(2); // Should have bend points
  });

  it('should avoid collisions with leaf nodes during routing', async () => {
    const graph: ElkNode = {
      id: 'root',
      children: [
        { id: 'src', x: 100, y: 0, width: 50, height: 50 },
        { id: 'obstacle', x: 100, y: 100, width: 50, height: 50 },
        { id: 'tgt', x: 100, y: 200, width: 50, height: 50 },
      ],
      edges: [{ id: 'e1', sources: ['src'], targets: ['tgt'] }],
    };

    const svg = await renderSvg(graph, 'custom');
    // The edge should bend around the obstacle.
    // Without collision avoidance it would be a straight line M 125 50 L 125 200.
    // With avoidance, it should shift X.
    expect(svg).toContain('aws-edge');
    expect(svg).not.toContain('L 125 200');
  });

  it('should render provider-specific icons and containers', async () => {
    const graph: ElkNode = {
      id: 'root',
      properties: { cssClass: 'gcp-root' },
      children: [
        {
          id: 'c1',
          properties: {
            type: 'container',
            cssClass: 'gcp-vpc',
            iconPath: 'gcp.png',
          },
          children: [
            {
              id: 'n1',
              properties: { type: 'service', iconPath: 'compute.png' },
            },
          ],
        },
      ],
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('binary-data'));

    const svg = await renderSvg(graph, 'custom');
    expect(svg).toContain('gcp-vpc');
    expect(svg).toContain('class="gcp-container-label"');
    expect(svg).toContain('data:image/png;base64');
  });
});
