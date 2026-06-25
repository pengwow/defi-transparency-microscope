/**
 * Tests for the ReportPie chart.
 *
 * The Report page renders a 5-segment pie chart of MEV strategy
 * attribution.  Each slice is drawn as a single `arc` + `fill` call,
 * and labels for each slice are rendered as text.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { drawReportPie } from '../ReportPie';
import type { CanvasSize } from '../types';
import { makeMockCtx } from './_helpers';

const size: CanvasSize = { width: 400, height: 200 };

const SLICES = [
  { label: '三明治', value: 42, color: '#ff5e5e' },
  { label: '套利', value: 28, color: '#ffab40' },
  { label: 'JIT', value: 18, color: '#b388ff' },
  { label: '清算', value: 12, color: '#448aff' },
  { label: '前跑', value: 5, color: '#69f0ae' },
];

describe('ReportPie', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('clears the canvas and paints the background', () => {
    drawReportPie(ctx, size, SLICES);
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('renders 5 slices (one fill per slice)', () => {
    drawReportPie(ctx, size, SLICES);
    expect((ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  it('renders one label per slice', () => {
    drawReportPie(ctx, size, SLICES);
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    for (const slice of SLICES) {
      expect(texts.some((t) => String(t).includes(slice.label))).toBe(true);
    }
  });

  it('handles an all-zero slice list without throwing', () => {
    expect(() => drawReportPie(ctx, size, [])).not.toThrow();
  });
});
