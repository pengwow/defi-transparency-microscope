/**
 * Tests for the IlPnlChart grouped-bar chart.
 *
 * The chart renders N groups of 2 bars (V2 amber, V3 cyan), one
 * group per price-ratio scenario (e.g. 0.5x, 1x, 2x, 5x).  The
 * data shape is `{ label, v2, v3 }[]`.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { drawIlPnlChart } from '../IlPnlChart';
import type { CanvasSize } from '../types';
import { makeMockCtx } from './_helpers';

const size: CanvasSize = { width: 400, height: 220 };

const FOUR_SCENARIOS = [
  { label: '0.5x', v2: -50, v3: -90 },
  { label: '1x', v2: 0, v3: 0 },
  { label: '2x', v2: -50, v3: -90 },
  { label: '5x', v2: -120, v3: -180 },
];

describe('IlPnlChart', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('fills at least 8 rectangles for 4 groups of 2 bars', () => {
    drawIlPnlChart(ctx, size, FOUR_SCENARIOS);
    // 4 groups × 2 bars = 8 bar fillRect calls; 1 background fillRect call.
    // So total fillRect calls >= 9.
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(8);
  });

  it('draws a label per group', () => {
    drawIlPnlChart(ctx, size, FOUR_SCENARIOS);
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    // Each group has its label rendered below its pair of bars.
    expect(texts.some((t) => t === '0.5x')).toBe(true);
    expect(texts.some((t) => t === '1x')).toBe(true);
    expect(texts.some((t) => t === '2x')).toBe(true);
    expect(texts.some((t) => t === '5x')).toBe(true);
  });

  it('does not throw on an empty dataset', () => {
    expect(() => drawIlPnlChart(ctx, size, [])).not.toThrow();
  });

  it('handles a single-bar dataset', () => {
    expect(() =>
      drawIlPnlChart(ctx, size, [{ label: '1x', v2: 10, v3: 20 }]),
    ).not.toThrow();
  });
});
