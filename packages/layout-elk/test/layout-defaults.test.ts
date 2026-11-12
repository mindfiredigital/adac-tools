import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import ELK from 'elkjs/lib/elk.bundled.js';
import { parseAdacFromContent } from '@mindfiredigital/adac-parser';
import { unsupportedLayoutEngineWarning } from '@mindfiredigital/adac-validator';
import type { AdacConfig } from '@mindfiredigital/adac-validator';
import { buildElkGraph } from '../src/elk-builder.js';
import { applyLayoutPostProcessing } from '../src/post-layout.js';
import {
  DEFAULTABLE_OPTIONS,
  LAYOUT_DEFAULT_PROFILES,
  applyLayoutDefaults,
  describeAppliedDefaults,
  normalizeLayoutOptions,
  resolveLayoutDefaults,
} from '../src/layout-properties.js';
import type { ElkNode } from '../src/types.js';

const V1 = LAYOUT_DEFAULT_PROFILES.v1;

// ── Resolution and precedence ───────────────────────────────────────────────

describe('applyLayoutDefaults', () => {
  it('fills undeclared options and records where each came from', () => {
    const { merged, provenance } = applyLayoutDefaults({ gap: 1 }, V1);
    expect(merged.gap).toBe(1);
    expect(merged.direction).toBe('LR');
    expect(merged.containerPadding).toEqual(V1.containerPadding);
    expect(provenance).toEqual({
      gap: 'declared',
      direction: 'default',
      containerPadding: 'default',
    });
  });

  it('lets explicit values win over defaults', () => {
    const { merged, provenance } = applyLayoutDefaults(
      { direction: 'TB', containerPadding: 2 },
      V1
    );
    expect(merged.direction).toBe('TB');
    expect(merged.containerPadding).toBe(2);
    expect(provenance.direction).toBe('declared');
    expect(provenance.containerPadding).toBe('declared');
  });

  it('treats the deprecated routing alias as a declared edgeRouting', () => {
    const { merged, provenance } = applyLayoutDefaults(
      { routing: 'splines' },
      { edgeRouting: 'orthogonal' }
    );
    expect(provenance.edgeRouting).toBe('declared');
    expect(merged.edgeRouting).toBeUndefined();
  });

  it('does not modify the declared options', () => {
    const declared = { gap: 1 };
    applyLayoutDefaults(declared, V1);
    expect(declared).toEqual({ gap: 1 });
  });

  it('applies nothing without a profile', () => {
    const { merged, provenance } = applyLayoutDefaults({});
    expect(merged).toEqual({});
    expect(provenance).toEqual({});
  });
});

describe('normalizeLayoutOptions with defaults', () => {
  it('resolves default lengths through unitSize like declared ones', () => {
    const o = normalizeLayoutOptions({ unitSize: 50 }, undefined, V1);
    expect(o.containerPadding).toEqual({
      top: 30,
      right: 15,
      bottom: 15,
      left: 15,
    });
    expect(o.provenance.containerPadding).toBe('default');
  });

  it('reports no provenance when nothing is set or defaulted', () => {
    expect(normalizeLayoutOptions(undefined).provenance).toEqual({});
  });
});

describe('describeAppliedDefaults', () => {
  it('names only the defaulted options', () => {
    const { provenance } = applyLayoutDefaults({ direction: 'TB' }, V1);
    expect(describeAppliedDefaults(provenance, V1)).toBe(
      'containerPadding={"top":0.6,"right":0.3,"bottom":0.3,"left":0.3}'
    );
  });

  it('is silent when every option was declared', () => {
    const { provenance } = applyLayoutDefaults(
      { direction: 'TB', containerPadding: 1 },
      V1
    );
    expect(describeAppliedDefaults(provenance, V1)).toBeUndefined();
  });
});

describe('default profiles', () => {
  it('only default options on the allowed list', () => {
    for (const profile of Object.values(LAYOUT_DEFAULT_PROFILES)) {
      for (const key of Object.keys(profile)) {
        expect(DEFAULTABLE_OPTIONS).toContain(key);
      }
    }
  });

  it('never default placement, wrapping, sizes or arrangement', () => {
    const forbidden = [
      'order',
      'position',
      'wrap',
      'itemsPerLine',
      'maxItemsPerLine',
      'size',
      'minSize',
      'maxSize',
      'align',
      'justify',
      'gap',
      'edgeSpacing',
      'edgeRouting',
    ];
    for (const key of forbidden) {
      expect(Object.keys(V1)).not.toContain(key);
    }
  });

  it('none is empty', () => {
    expect(LAYOUT_DEFAULT_PROFILES.none).toEqual({});
  });
});

describe('resolveLayoutDefaults', () => {
  const custom = { direction: 'TB' as const };

  it('uses v1 when nothing picks a profile', () => {
    expect(resolveLayoutDefaults(undefined)).toBe(LAYOUT_DEFAULT_PROFILES.v1);
  });

  it('uses a caller override when the file does not pick one', () => {
    expect(resolveLayoutDefaults(undefined, custom)).toBe(custom);
  });

  it("lets the file's own choice win over a caller override", () => {
    expect(resolveLayoutDefaults('none', custom)).toBe(
      LAYOUT_DEFAULT_PROFILES.none
    );
  });

  it('warns and falls back to v1 for an unknown profile', () => {
    for (const name of ['v2', 'constructor', 42]) {
      const warnings: string[] = [];
      expect(
        resolveLayoutDefaults(name, undefined, (m) => warnings.push(m))
      ).toBe(LAYOUT_DEFAULT_PROFILES.v1);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('is not a known profile');
    }
  });
});

// ── In the graph ────────────────────────────────────────────────────────────

const YAML_DIR = path.resolve(__dirname, '../../../yamls');
const load = (name: string): AdacConfig =>
  parseAdacFromContent(fs.readFileSync(path.join(YAML_DIR, name), 'utf8'), {
    validate: false,
  }) as AdacConfig;

function paddings(node: ElkNode, out: string[] = []): string[] {
  for (const child of node.children ?? []) {
    if ((child.children ?? []).length > 0) {
      out.push(String(child.layoutOptions?.['elk.padding']));
    }
    paddings(child, out);
  }
  return out;
}

function hasArrangement(node: ElkNode): boolean {
  const properties = node.properties as { arrangement?: unknown } | undefined;
  return (
    !!properties?.arrangement ||
    (node.children ?? []).some((child) => hasArrangement(child))
  );
}

async function laidOut(cfg: AdacConfig, options = {}) {
  const graph = await buildElkGraph(cfg, { onWarning: () => {}, ...options });
  const out = (await new ELK().layout(graph as never)) as unknown as ElkNode;
  applyLayoutPostProcessing(out);
  return out;
}

describe('default profile in the graph', () => {
  it('applies the v1 padding to a file that declares no layout', async () => {
    const graph = await buildElkGraph(load('aws.adac.yaml'), {
      onWarning: () => {},
    });
    const found = paddings(graph);
    expect(found.length).toBeGreaterThan(0);
    expect(new Set(found).size).toBe(1);
    expect(found[0]).toContain('top=60');
    expect(found[0]).toContain('left=30');
  });

  it('keeps the old padding with defaults: none', async () => {
    const cfg = load('aws.adac.yaml');
    cfg.layoutOptions = { defaults: 'none' };
    const graph = await buildElkGraph(cfg, { onWarning: () => {} });
    expect(new Set(paddings(graph))).toEqual(
      new Set(['[top=60,left=40,bottom=40,right=40]'])
    );
  });

  it('keeps defaults: none even when a caller overrides the profile', async () => {
    const cfg = load('aws.adac.yaml');
    cfg.layoutOptions = { defaults: 'none' };
    const graph = await buildElkGraph(cfg, {
      onWarning: () => {},
      layoutDefaults: LAYOUT_DEFAULT_PROFILES.v1,
    });
    expect(new Set(paddings(graph))).toEqual(
      new Set(['[top=60,left=40,bottom=40,right=40]'])
    );
  });

  it('lets a declared containerPadding win over the default', async () => {
    const cfg = load('aws.adac.yaml');
    cfg.layoutOptions = { containerPadding: 1 };
    const graph = await buildElkGraph(cfg, { onWarning: () => {} });
    expect(new Set(paddings(graph))).toEqual(
      new Set(['[top=100,left=100,bottom=100,right=100]'])
    );
  });

  it('does not arrange any container', async () => {
    const graph = await buildElkGraph(load('aws.adac.yaml'), {
      onWarning: () => {},
    });
    expect(hasArrangement(graph)).toBe(false);
  });

  it('is elk-only', async () => {
    const graph = await buildElkGraph(load('aws.adac.yaml'), {
      onWarning: () => {},
      declarativeStyle: false,
    });
    expect(new Set(paddings(graph))).toEqual(
      new Set(['[top=60,left=40,bottom=40,right=40]'])
    );
  });

  it('logs the applied defaults once, and not when none apply', async () => {
    const lines: string[] = [];
    await buildElkGraph(load('aws.adac.yaml'), {
      onWarning: () => {},
      onDebug: (m) => lines.push(m),
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^Layout defaults applied: .*containerPadding/);

    const none: string[] = [];
    const cfg = load('aws.adac.yaml');
    cfg.layoutOptions = { defaults: 'none' };
    await buildElkGraph(cfg, {
      onWarning: () => {},
      onDebug: (m) => none.push(m),
    });
    expect(none).toEqual([]);
  });

  it('never makes a file warn on a non-elk engine', () => {
    // the warning reads the declared document, which defaults never touch
    const cfg = load('aws.adac.yaml');
    expect(unsupportedLayoutEngineWarning(cfg, 'custom')).toBeUndefined();
  });
});

// ── End to end: a legacy sample and both declarative examples ──────────────

function overlapCount(node: ElkNode): number {
  const kids = (node.children ?? []).filter(
    (k) =>
      (k.properties as { type?: string } | undefined)?.type !== 'layout-line'
  );
  let count = 0;
  for (let i = 0; i < kids.length; i++) {
    for (let j = i + 1; j < kids.length; j++) {
      const a = kids[i];
      const b = kids[j];
      const ix =
        Math.min(a.x! + a.width!, b.x! + b.width!) - Math.max(a.x!, b.x!);
      const iy =
        Math.min(a.y! + a.height!, b.y! + b.height!) - Math.max(a.y!, b.y!);
      if (ix > 1 && iy > 1) count++;
    }
  }
  return count + kids.reduce((n, k) => n + overlapCount(k), 0);
}

describe.each([
  'aws.adac.yaml',
  'aws_declarative_layout.adac.yaml',
  'aws_ecs_microservices_layout.adac.yaml',
])('%s on elk with the default profile', (file) => {
  it('renders without overlaps and no larger than without defaults', async () => {
    const withDefaults = await laidOut(load(file));
    const without = await laidOut(load(file), {
      layoutDefaults: LAYOUT_DEFAULT_PROFILES.none,
    });
    expect(overlapCount(withDefaults)).toBe(0);
    expect(withDefaults.width! * withDefaults.height!).toBeLessThanOrEqual(
      without.width! * without.height! * 1.01
    );
  });
});

describe('declared layout is unchanged by the profile', () => {
  it.each([
    'aws_declarative_layout.adac.yaml',
    'aws_ecs_microservices_layout.adac.yaml',
  ])('%s keeps its geometry', async (file) => {
    const withDefaults = await laidOut(load(file));
    const without = await laidOut(load(file), {
      layoutDefaults: LAYOUT_DEFAULT_PROFILES.none,
    });
    expect([withDefaults.width, withDefaults.height]).toEqual([
      without.width,
      without.height,
    ]);
  });
});
