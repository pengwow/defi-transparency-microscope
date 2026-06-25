/**
 * Tests for the ReportRadar chart.
 *
 * The Report page renders a 5-axis radar of risk dimensions:
 *   - 频率 (frequency)
 *   - 复杂度 (complexity)
 *   - 单笔利润 (profit per trade)
 *   - 防御难度 (defense difficulty)
 *   - 检测难度 (detection difficulty)
 *
 * The visualisation:
 *   1. Background pentagon (5 sided polygon) for the outer frame.
 *   2. Inner gridlines as concentric pentagons.
 *   3. One filled data polygon for the user's actual risk values.
 *   4. Axis labels rendered at each vertex.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { drawReportRadar } from '../ReportRadar';
import type { CanvasSize } from '../types';
import { makeMockCtx } from './_helpers';

const size: CanvasSize = { width: 400, height: 240 };

const AXES = [
  { label: '频率', value: 80, max: 100 },
  { label: '复杂度', value: 60, max: 100 },
  { label: '单笔利润', value: 90, max: 100 },
  { label: '防御难度', value: 75, max: 100 },
  { label: '检测难度', value: 50, max: 100 },
];

describe('ReportRadar', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('clears the canvas and paints the background', () => {
    drawReportRadar(ctx, size, AXES);
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('draws >= 6 strokes (5-sided outer + data polygon + grid lines)', () => {
    drawReportRadar(ctx, size, AXES);
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(6);
  });

  it('renders one label per axis', () => {
    drawReportRadar(ctx, size, AXES);
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    for (const axis of AXES) {
      expect(texts.some((t) => String(t).includes(axis.label))).toBe(true);
    }
  });

  it('handles an empty axis list without throwing', () => {
    expect(() => drawReportRadar(ctx, size, [])).not.toThrow();
  });
});
