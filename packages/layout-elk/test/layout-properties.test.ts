import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_UNIT_SIZE,
  LAYOUT_DEFAULT_PROFILES,
  chunkIntoLines,
  declaresArrangement,
  directionToElk,
  inheritLayout,
  layerConstraintFor,
  lineLimitOf,
  mergePadding,
  normalizeLayoutOptions,
  partitionByPosition,
  positionComponents,
  resolveGap,
  resolvePadding,
  resolveSize,
  resolveUnit,
  rootInheritedLayout,
  sideToElk,
  sortByOrder,
} from '../src/layout-properties.js';

describe('layout-properties', () => {
  describe('resolveUnit', () => {
    it('multiplies logical units by unitSize', () => {
      expect(resolveUnit(2, 100)).toBe(200);
      expect(resolveUnit(0.5, 80)).toBe(40);
      expect(resolveUnit(0, 100)).toBe(0);
    });

    it('defaults to the documented unit size', () => {
      expect(DEFAULT_UNIT_SIZE).toBe(100);
      expect(resolveUnit(1.5)).toBe(150);
    });

    it('does not accumulate floating point noise', () => {
      expect(resolveUnit(0.1, 3)).toBe(0.3);
    });
  });

  describe('resolveGap', () => {
    it('expands a scalar gap to both axes', () => {
      expect(resolveGap(2, 50)).toEqual({ horizontal: 100, vertical: 100 });
    });

    it('keeps only the declared axes of an object gap', () => {
      expect(resolveGap({ horizontal: 2 }, 50)).toEqual({ horizontal: 100 });
      expect(resolveGap(undefined, 50)).toBeUndefined();
    });
  });

  describe('resolvePadding', () => {
    it('expands scalar padding to all sides and keeps declared sides', () => {
      expect(resolvePadding(1, 100)).toEqual({
        top: 100,
        right: 100,
        bottom: 100,
        left: 100,
      });
      expect(resolvePadding({ top: 2, left: 1 }, 100)).toEqual({
        top: 200,
        left: 100,
      });
    });
  });

  describe('mergePadding', () => {
    it('merges padding over defaults side by side', () => {
      const base = { top: 60, right: 40, bottom: 40, left: 40 };
      expect(mergePadding(base, { left: 10 }, undefined, { top: 5 })).toEqual({
        top: 5,
        right: 40,
        bottom: 40,
        left: 10,
      });
    });
  });

  describe('resolveSize', () => {
    it('treats auto and absent dimensions as unconstrained', () => {
      expect(resolveSize({ width: 'auto', height: 2 }, 100)).toEqual({
        height: 200,
      });
      expect(resolveSize(undefined, 100)).toEqual({});
    });
  });

  describe('normalizeLayoutOptions', () => {
    it('applies defaults', () => {
      const o = normalizeLayoutOptions(undefined);
      expect(o).toMatchObject({
        unitSize: 100,
        direction: 'LR',
        provenance: {},
        background: false,
      });
      expect(o.gap).toBeUndefined();
    });

    it('resolves lengths through unitSize', () => {
      const o = normalizeLayoutOptions({
        unitSize: 40,
        gap: 2,
        containerPadding: 1,
        edgeSpacing: 1.5,
      });
      expect(o.gap).toEqual({ horizontal: 80, vertical: 80 });
      expect(o.containerPadding?.top).toBe(40);
      expect(o.edgeSpacing).toBe(60);
    });

    it('maps deprecated aliases and warns', () => {
      const warn = vi.fn();
      const o = normalizeLayoutOptions({ unit: 10, routing: 'splines' }, warn);
      expect(o.unitSize).toBe(10);
      expect(o.edgeRouting).toBe('splines');
      expect(warn).toHaveBeenCalledTimes(2);
    });

    it('prefers the new names over the aliases', () => {
      const o = normalizeLayoutOptions(
        {
          unit: 10,
          unitSize: 20,
          routing: 'splines',
          edgeRouting: 'orthogonal',
        },
        () => {}
      );
      expect(o.unitSize).toBe(20);
      expect(o.edgeRouting).toBe('orthogonal');
    });

    it('does not warn for the current names', () => {
      const warn = vi.fn();
      normalizeLayoutOptions(
        { unitSize: 100, edgeRouting: 'orthogonal' },
        warn
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it('resolves a defaults profile through a non-default unitSize', () => {
      const o = normalizeLayoutOptions(
        { unitSize: 40 },
        undefined,
        LAYOUT_DEFAULT_PROFILES.v1
      );
      // 0.6 / 0.3 logical units at 40px per unit, not at the default 100
      expect(o.containerPadding).toEqual({
        top: 24,
        right: 12,
        bottom: 12,
        left: 12,
      });
      expect(o.direction).toBe('LR');
      expect(o.provenance).toEqual({
        direction: 'default',
        containerPadding: 'default',
      });
    });

    it('lets a declared value win over the profile under a non-default unitSize', () => {
      const o = normalizeLayoutOptions(
        { unitSize: 40, containerPadding: 1 },
        undefined,
        LAYOUT_DEFAULT_PROFILES.v1
      );
      expect(o.containerPadding?.top).toBe(40);
      expect(o.provenance.containerPadding).toBe('declared');
      expect(o.provenance.direction).toBe('default');
    });
  });

  describe('inheritance: global → nearest declaring ancestor → element', () => {
    // The example from the specification
    const global = normalizeLayoutOptions({
      unitSize: 100,
      direction: 'LR',
      gap: 2,
    });

    describe('rootInheritedLayout', () => {
      it('starts from the global defaults, not arranged', () => {
        const root = rootInheritedLayout(global);
        expect(root).toMatchObject({
          direction: 'LR',
          gap: { horizontal: 200, vertical: 200 },
          arranged: false,
        });
      });
    });

    describe('inheritLayout', () => {
      it('resolves the VPC / private subnet example', () => {
        const root = rootInheritedLayout(global);
        const vpc = inheritLayout(root, { direction: 'TB', gap: 1 }, 100);
        const subnet = inheritLayout(vpc, { direction: 'LR' }, 100);

        expect(vpc.direction).toBe('TB');
        expect(vpc.gap).toEqual({ horizontal: 100, vertical: 100 });
        expect(subnet.direction).toBe('LR');
        // gap is inherited from the VPC, not the root
        expect(subnet.gap).toEqual({ horizontal: 100, vertical: 100 });
      });

      it('inherits direction, gap, align and justify through undeclaring elements', () => {
        const root = rootInheritedLayout(global);
        const vpc = inheritLayout(
          root,
          { direction: 'TB', align: 'center', justify: 'end' },
          100
        );
        const child = inheritLayout(vpc, undefined, 100);
        expect(child).toEqual(vpc);
        expect(child.align).toBe('center');
        expect(child.justify).toBe('end');
      });

      it('merges a partial gap per axis', () => {
        const root = rootInheritedLayout(global);
        const c = inheritLayout(root, { gap: { vertical: 0.5 } }, 100);
        expect(c.gap).toEqual({ horizontal: 200, vertical: 50 });
      });

      it('never inherits packing, padding, sizes, order or position', () => {
        const root = rootInheritedLayout(global);
        const parent = inheritLayout(
          root,
          {
            maxItemsPerLine: 2,
            itemsPerLine: undefined,
            padding: 3,
            minSize: { width: 5 },
            order: 1,
            position: 'top-left',
          },
          100
        );
        const keys = Object.keys(parent).sort();
        expect(keys).toEqual(
          ['align', 'arranged', 'direction', 'gap', 'justify'].sort()
        );
      });

      it('is arranged once an ancestor declares an arrangement, and stays so', () => {
        const root = rootInheritedLayout(global);
        const gapOnly = inheritLayout(root, { gap: 1, padding: 1 }, 100);
        expect(gapOnly.arranged).toBe(false);

        const declared = inheritLayout(root, { direction: 'TB' }, 100);
        expect(declared.arranged).toBe(true);
        expect(inheritLayout(declared, undefined, 100).arranged).toBe(true);
        expect(inheritLayout(declared, { gap: 1 }, 100).arranged).toBe(true);
      });
    });

    describe('declaresArrangement', () => {
      it('is true only for arrangement properties', () => {
        expect(declaresArrangement(undefined)).toBe(false);
        expect(declaresArrangement({ gap: 1, padding: 1, order: 1 })).toBe(
          false
        );
        for (const layout of [
          { direction: 'LR' },
          { wrap: true },
          { itemsPerLine: 2 },
          { maxItemsPerLine: 2 },
          { align: 'center' },
          { justify: 'end' },
        ] as const) {
          expect(declaresArrangement(layout)).toBe(true);
        }
      });
    });
  });

  describe('lineLimitOf', () => {
    it('reads itemsPerLine as exact and maxItemsPerLine as a maximum', () => {
      expect(lineLimitOf({ itemsPerLine: 3 })).toEqual({
        kind: 'exact',
        count: 3,
      });
      expect(lineLimitOf({ maxItemsPerLine: 3 })).toEqual({
        kind: 'max',
        count: 3,
      });
      expect(lineLimitOf({})).toBeUndefined();
      expect(lineLimitOf(undefined)).toBeUndefined();
    });

    it('ignores line limits below 1 instead of looping forever', () => {
      for (const bad of [0, -2, 0.5, Number.NaN]) {
        expect(lineLimitOf({ itemsPerLine: bad })).toBeUndefined();
        expect(lineLimitOf({ maxItemsPerLine: bad })).toBeUndefined();
      }
      expect(lineLimitOf({ itemsPerLine: 2.7 })).toEqual({
        kind: 'exact',
        count: 2,
      });
    });

    it('wrap:false disables a line limit', () => {
      expect(lineLimitOf({ wrap: false, maxItemsPerLine: 3 })).toBeUndefined();
    });
  });

  describe('chunkIntoLines', () => {
    const nums = (n: number) => Array.from({ length: n }, (_, i) => i);

    it('does not loop on a limit below 1', () => {
      const items = [1, 2, 3];
      expect(chunkIntoLines(items, { kind: 'exact', count: 0 })).toEqual([
        items,
      ]);
      expect(chunkIntoLines(items, { kind: 'max', count: -1 })).toEqual([
        items,
      ]);
    });

    it('fills exact lines', () => {
      expect(chunkIntoLines(nums(5), { kind: 'exact', count: 2 })).toEqual([
        [0, 1],
        [2, 3],
        [4],
      ]);
    });

    it('balances max lines', () => {
      expect(chunkIntoLines(nums(5), { kind: 'max', count: 4 })).toEqual([
        [0, 1, 2],
        [3, 4],
      ]);
      expect(chunkIntoLines(nums(6), { kind: 'max', count: 3 })).toEqual([
        [0, 1, 2],
        [3, 4, 5],
      ]);
      expect(chunkIntoLines(nums(2), { kind: 'max', count: 4 })).toEqual([
        [0, 1],
      ]);
    });

    it('puts everything on one line without a limit and nothing for no items', () => {
      expect(chunkIntoLines(nums(3))).toEqual([[0, 1, 2]]);
      expect(chunkIntoLines([], { kind: 'exact', count: 2 })).toEqual([]);
    });
  });

  describe('sortByOrder', () => {
    const place =
      (m: Record<string, { order?: number; position?: never }>) =>
      (id: string) =>
        m[id] ?? {};

    it('sorts by order, then declaration index, unordered last', () => {
      const ids = ['a', 'b', 'c', 'd'];
      const sorted = sortByOrder(
        ids,
        place({ c: { order: 1 }, a: { order: 5 } })
      );
      expect(sorted).toEqual(['c', 'a', 'b', 'd']);
    });

    it('is stable for equal order values', () => {
      const ids = ['x', 'y', 'z'];
      expect(
        sortByOrder(
          ids,
          place({ x: { order: 1 }, y: { order: 1 }, z: { order: 1 } })
        )
      ).toEqual(ids);
    });
  });

  describe('positionComponents', () => {
    it('splits a position into screen components', () => {
      expect(positionComponents('top-left')).toEqual({
        vertical: 'start',
        horizontal: 'start',
      });
      expect(positionComponents('bottom-right')).toEqual({
        vertical: 'end',
        horizontal: 'end',
      });
      expect(positionComponents('center-right')).toEqual({
        vertical: 'center',
        horizontal: 'end',
      });
      expect(positionComponents('top-center')).toEqual({
        vertical: 'start',
        horizontal: 'center',
      });
      expect(positionComponents('center')).toEqual({
        vertical: 'center',
        horizontal: 'center',
      });
    });
  });

  describe('partitionByPosition', () => {
    it('partitions by the requested axis only', () => {
      const pos = {
        a: { position: 'bottom-left' as const },
        b: {},
        c: { position: 'top-right' as const },
      };
      const get = (id: string) => pos[id as keyof typeof pos];
      expect(partitionByPosition(['a', 'b', 'c'], get, 'horizontal')).toEqual([
        'a',
        'b',
        'c',
      ]);
      expect(partitionByPosition(['a', 'b', 'c'], get, 'vertical')).toEqual([
        'c',
        'b',
        'a',
      ]);
    });
  });

  describe('layerConstraintFor', () => {
    it('maps position to a layer constraint on the flow axis', () => {
      expect(layerConstraintFor('center-left', 'LR')).toBe('FIRST');
      expect(layerConstraintFor('center-right', 'LR')).toBe('LAST');
      expect(layerConstraintFor('top-center', 'TB')).toBe('FIRST');
      expect(layerConstraintFor('bottom-center', 'TB')).toBe('LAST');
      // reversed flow mirrors the layer order
      expect(layerConstraintFor('center-left', 'RL')).toBe('LAST');
      expect(layerConstraintFor('top-center', 'BT')).toBe('LAST');
      // the cross-flow component alone does not pin a layer
      expect(layerConstraintFor('top-center', 'LR')).toBeUndefined();
      expect(layerConstraintFor('center', 'LR')).toBeUndefined();
      expect(layerConstraintFor(undefined, 'LR')).toBeUndefined();
    });
  });

  describe('directionToElk', () => {
    it('maps directions without leaking ELK names into the spec', () => {
      expect(directionToElk('LR')).toBe('RIGHT');
      expect(directionToElk('RL')).toBe('LEFT');
      expect(directionToElk('TB')).toBe('DOWN');
      expect(directionToElk('BT')).toBe('UP');
    });
  });

  describe('sideToElk', () => {
    it('maps sides without leaking ELK names into the spec', () => {
      expect(sideToElk('left')).toBe('WEST');
      expect(sideToElk('right')).toBe('EAST');
      expect(sideToElk('top')).toBe('NORTH');
      expect(sideToElk('bottom')).toBe('SOUTH');
      expect(sideToElk('auto')).toBeUndefined();
      expect(sideToElk(undefined)).toBeUndefined();
    });
  });
});
