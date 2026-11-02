import { describe, it, expect } from 'vitest';
import { validateAdacConfig } from '../src/validator.js';

type Json = Record<string, unknown>;

function config(overrides: Json = {}, serviceVisual?: Json): Json {
  return {
    version: '0.2',
    metadata: { name: 'Layout Test', created: '2026-01-01' },
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

const withOptions = (layoutOptions: Json) => config({ layoutOptions });
const withLayout = (layout: Json) => config({}, { layout });
const withConnection = (extra: Json) =>
  config({
    connections: [
      { id: 'c1', from: 'vpc', to: 'db', type: 'api-call', ...extra },
    ],
  });

describe('layout schema validation', () => {
  describe('valid declarations', () => {
    it('accepts a full layoutOptions block', () => {
      const result = validateAdacConfig(
        withOptions({
          engine: 'elk',
          unitSize: 100,
          direction: 'LR',
          gap: 1,
          containerPadding: 1,
          align: 'center',
          justify: 'start',
          edgeSpacing: 1,
          edgeRouting: 'orthogonal',
          background: false,
          edgeLabels: false,
          labelMaxChars: 16,
        })
      );
      expect(result.errors).toBeUndefined();
      expect(result.valid).toBe(true);
    });

    it('accepts object forms of gap and padding', () => {
      const result = validateAdacConfig(
        withOptions({
          gap: { horizontal: 2, vertical: 1 },
          containerPadding: { top: 2, right: 1, bottom: 2, left: 1 },
        })
      );
      expect(result.valid).toBe(true);
    });

    it('accepts a full visual.layout and visual.style', () => {
      const result = validateAdacConfig(
        config(
          {},
          {
            layout: {
              direction: 'TB',
              gap: 1,
              padding: 1,
              align: 'center',
              justify: 'space-between',
              wrap: true,
              maxItemsPerLine: 3,
              order: 2,
              position: 'top-left',
              size: { width: 'auto', height: 'auto' },
              minSize: { width: 3, height: 2 },
              maxSize: { width: 10, height: 8 },
            },
            style: { background: true, labelMaxChars: 20 },
          }
        )
      );
      expect(result.errors).toBeUndefined();
      expect(result.valid).toBe(true);
    });

    it('accepts connection layout and bidirectional', () => {
      const result = validateAdacConfig(
        withConnection({
          bidirectional: true,
          layout: { fromSide: 'right', toSide: 'left', routing: 'orthogonal' },
        })
      );
      expect(result.valid).toBe(true);
    });

    it('accepts itemsPerLine on its own', () => {
      expect(validateAdacConfig(withLayout({ itemsPerLine: 4 })).valid).toBe(
        true
      );
    });
  });

  describe('invalid declarations', () => {
    it.each([
      ['direction', { direction: 'sideways' }],
      ['align', { align: 'stretch' }],
      ['justify', { justify: 'space-evenly' }],
      ['position', { position: 'middle' }],
      ['gap (negative)', { gap: -1 }],
      ['gap (string)', { gap: 'wide' }],
      ['gap (unknown axis)', { gap: { diagonal: 1 } }],
      ['padding (negative)', { padding: -2 }],
      ['padding (unknown side)', { padding: { middle: 1 } }],
      ['size (zero)', { size: { width: 0 } }],
      ['size (bad keyword)', { minSize: { width: 'huge' } }],
      ['maxItemsPerLine (zero)', { maxItemsPerLine: 0 }],
      ['maxItemsPerLine (fraction)', { maxItemsPerLine: 1.5 }],
      ['unknown property', { float: 'left' }],
    ])('rejects invalid element layout: %s', (_name, layout) => {
      expect(validateAdacConfig(withLayout(layout)).valid).toBe(false);
    });

    it.each([
      ['direction', { direction: 'UP' }],
      ['unitSize (zero)', { unitSize: 0 }],
      ['unitSize (negative)', { unitSize: -10 }],
      ['edgeRouting', { edgeRouting: 'diagonal' }],
      ['edgeSpacing (negative)', { edgeSpacing: -1 }],
      ['background (string)', { background: 'yes' }],
      ['edgeLabels (string)', { edgeLabels: 'no' }],
      ['labelMaxChars (too small)', { labelMaxChars: 3 }],
      ['labelMaxChars (too large)', { labelMaxChars: 81 }],
      ['labelMaxChars (fraction)', { labelMaxChars: 10.5 }],
      ['labelMaxChars (string)', { labelMaxChars: 'wide' }],
      ['engine', { engine: 'graphviz' }],
      ['unknown property', { speed: 'fast' }],
    ])('rejects invalid layoutOptions: %s', (_name, options) => {
      expect(validateAdacConfig(withOptions(options)).valid).toBe(false);
    });

    it.each([
      ['background (string)', { background: 'yes' }],
      ['labelMaxChars (too small)', { labelMaxChars: 3 }],
      ['labelMaxChars (too large)', { labelMaxChars: 81 }],
      ['labelMaxChars (fraction)', { labelMaxChars: 10.5 }],
      ['unknown property', { color: 'red' }],
    ])('rejects invalid visual.style: %s', (_name, style) => {
      expect(validateAdacConfig(config({}, { style })).valid).toBe(false);
    });

    it.each([
      ['fromSide', { layout: { fromSide: 'diagonal' } }],
      ['toSide', { layout: { toSide: 'middle' } }],
      ['routing', { layout: { routing: 'wavy' } }],
      ['bidirectional', { bidirectional: 'yes' }],
    ])('rejects invalid connection layout: %s', (_name, extra) => {
      expect(validateAdacConfig(withConnection(extra)).valid).toBe(false);
    });
  });

  describe('invalid property combinations', () => {
    it('rejects itemsPerLine together with maxItemsPerLine', () => {
      const result = validateAdacConfig(
        withLayout({ itemsPerLine: 3, maxItemsPerLine: 4 })
      );
      expect(result.valid).toBe(false);
    });

    it('rejects wrap:false combined with a line limit', () => {
      expect(
        validateAdacConfig(withLayout({ wrap: false, maxItemsPerLine: 2 }))
          .valid
      ).toBe(false);
      expect(
        validateAdacConfig(withLayout({ wrap: false, itemsPerLine: 2 })).valid
      ).toBe(false);
    });

    it('rejects minSize larger than maxSize', () => {
      const result = validateAdacConfig(
        withLayout({
          minSize: { width: 10, height: 2 },
          maxSize: { width: 5, height: 8 },
        })
      );
      expect(result.valid).toBe(false);
      expect(result.errors?.join('\n')).toMatch(/minSize\/width/);
    });

    it('rejects an explicit size outside min/max', () => {
      const result = validateAdacConfig(
        withLayout({ size: { width: 2 }, minSize: { width: 4 } })
      );
      expect(result.valid).toBe(false);
    });
  });

  describe('deprecated aliases', () => {
    it('accepts unit and routing but warns', () => {
      const result = validateAdacConfig(
        withOptions({ unit: 80, routing: 'orthogonal' })
      );
      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('/layoutOptions/unit is deprecated'),
          expect.stringContaining('/layoutOptions/routing is deprecated'),
        ])
      );
    });

    it('warns when both an alias and its replacement are set', () => {
      const result = validateAdacConfig(
        withOptions({ unit: 80, unitSize: 100 })
      );
      expect(result.valid).toBe(true);
      expect(result.warnings?.join('\n')).toMatch(/both unit and unitSize/);
    });

    it('does not warn for the new names', () => {
      const result = validateAdacConfig(
        withOptions({ unitSize: 100, edgeRouting: 'orthogonal' })
      );
      expect(result.warnings).toBeUndefined();
    });
  });
});

describe('layout checks on malformed documents', () => {
  it('does not throw when applications or services are not arrays', () => {
    expect(() =>
      validateAdacConfig({
        version: '0.2',
        metadata: { name: 'Bad', created: '2026-01-01' },
        applications: { not: 'an array' },
        infrastructure: { clouds: [{ id: 'aws', services: 'nope' }] },
      })
    ).not.toThrow();
  });
});
