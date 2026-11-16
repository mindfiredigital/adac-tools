import { describe, it, expect } from 'vitest';
import { layoutEngineWarnings } from './generation-warnings';

const HINT = ' Use --layout elk or set layoutOptions.engine: elk.';
const SHOWN =
  'Layout engine "custom" ignores declarative layout properties: layoutOptions (gap).';
const WARNING = SHOWN + HINT;

describe('layoutEngineWarnings', () => {
  it('extracts the engine warning without its timestamp or prefix', () => {
    const logs = [
      '[2026-01-01T00:00:00.000Z] Starting diagram generation.',
      `[2026-01-01T00:00:00.100Z] Warning: ${WARNING}`,
      '[2026-01-01T00:00:00.200Z] Generation complete in 5ms',
    ];
    expect(layoutEngineWarnings(logs)).toEqual([SHOWN]);
  });

  it('ignores other warnings', () => {
    expect(
      layoutEngineWarnings([
        '[2026-01-01T00:00:00.000Z] Warning: layoutOptions.unit is deprecated; use layoutOptions.unitSize',
      ])
    ).toEqual([]);
  });

  it('does not repeat a warning', () => {
    const line = `[2026-01-01T00:00:00.000Z] Warning: ${WARNING}`;
    expect(layoutEngineWarnings([line, line])).toEqual([SHOWN]);
  });

  it('copes with missing or empty logs', () => {
    expect(layoutEngineWarnings(undefined)).toEqual([]);
    expect(layoutEngineWarnings([])).toEqual([]);
  });
});
