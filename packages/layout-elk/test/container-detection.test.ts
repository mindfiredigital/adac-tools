import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { parseAdacFromContent } from '@mindfiredigital/adac-parser';
import {
  collectDeclaredLayoutProperties,
  type AdacConfig,
} from '@mindfiredigital/adac-validator';
import { buildElkGraph } from '../src/elk-builder.js';
import type { ElkNode } from '../src/types.js';

/**
 * The validator decides which elements are containers (and so which `size`
 * declarations only ELK honours) from the document alone, in `containerIds`.
 * The builder decides it by nesting nodes. The two must agree, or a file
 * would get the warning for the wrong services.
 */
const SAMPLES = fileURLToPath(new URL('../../../yamls', import.meta.url));

const files = readdirSync(SAMPLES)
  .filter((f) => f.endsWith('.adac.yaml'))
  .sort();

type Service =
  AdacConfig['infrastructure']['clouds'][number]['services'][number];

/** A copy of the document with a `size` on the services (all, or only `onlyId`). */
function withSize(base: AdacConfig, onlyId?: string): AdacConfig {
  const copy = structuredClone(base);
  for (const cloud of copy.infrastructure.clouds) {
    for (const service of (cloud.services ?? []) as Service[]) {
      if (onlyId !== undefined && service.id !== onlyId) continue;
      service.visual = {
        ...service.visual,
        layout: { ...service.visual?.layout, size: { width: 1, height: 1 } },
      };
    }
  }
  return copy;
}

function nodesById(root: ElkNode): Map<string, ElkNode> {
  const nodes = new Map<string, ElkNode>();
  const visit = (n: ElkNode) => {
    nodes.set(n.id, n);
    n.children?.forEach(visit);
  };
  visit(root);
  return nodes;
}

describe('container detection: validator and builder agree', () => {
  // what the samples hold, so the comparison below cannot pass by seeing nothing
  const seen = { containers: 0, leaves: 0 };

  it('finds the sample files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files)(
    'the container-size warning fires exactly for services with children: %s',
    async (file) => {
      // not validated: a few samples predate the schema, and only their
      // structure matters here
      const base = parseAdacFromContent(
        readFileSync(path.join(SAMPLES, file), 'utf8'),
        { validate: false }
      );
      const serviceIds = base.infrastructure.clouds
        .flatMap((c) => (c.services ?? []) as Service[])
        .map((s) => s.id);
      expect(serviceIds.length).toBeGreaterThan(0);

      // every service declares a size, so every container shows it
      const graph = await buildElkGraph(withSize(base), {
        onWarning: () => undefined,
      });
      const nodes = nodesById(graph);

      const disagreements: string[] = [];
      for (const id of serviceIds) {
        const node = nodes.get(id);
        const builtAsContainer = (node?.children?.length ?? 0) > 0;
        seen[builtAsContainer ? 'containers' : 'leaves']++;
        // only this service declares a size: the warning fires if the
        // validator takes it for a container
        const flagged = collectDeclaredLayoutProperties(
          withSize(base, id)
        ).elementLayout.includes('size');
        if (flagged !== builtAsContainer) {
          disagreements.push(
            `${id}: validator ${flagged ? 'flags it' : 'does not flag it'}, ` +
              `builder ${builtAsContainer ? 'gives it' : 'gives it no'} children`
          );
        }
      }
      expect(disagreements).toEqual([]);
    }
  );

  it('compared both containers and plain nodes', () => {
    expect(seen.containers).toBeGreaterThan(5);
    expect(seen.leaves).toBeGreaterThan(50);
  });
});
