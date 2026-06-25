/**
 * Tests for the ReportWaterfall chart.
 *
 * The Report page renders a 6-step profit waterfall covering the
 *   1. 攻击者利润 (searcher profit)
 *   2. 受害者损失 (victim loss)
 *   3. LP 损失 (LP loss)
 *   4. 协议费 (protocol fee)
 *   5. 验证者小费 (validator tip)
 *   6. 净效果 (net effect — total)
 *
 * Each step is rendered as a single `fillRect` (one fill per step).
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { drawReportWaterfall } from '../ReportWaterfall';
import type { CanvasSize } from '../types';
import { makeMockCtx } from './_helpers';

const size: CanvasSize = { width: 480, height: 220 };

const STEPS = [
  { label: '攻击者利润', delta: 1240, type: 'gain' as const },
  { label: '受害者损失', delta: -456, type: 'loss' as const },
  { label: 'LP 损失', delta: -89, type: 'loss' as const },
  { label: '协议费', delta: -12, type: 'loss' as const },
  { label: '验证者小费', delta: -45, type: 'loss' as const },
  { label: '净效果', delta: 638, type: 'total' as const },
];

describe('ReportWaterfall', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('clears the canvas and paints the background', () => {
    drawReportWaterfall(ctx, size, STEPS);
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('renders one fill per step (>= 6)', () => {
    drawReportWaterfall(ctx, size, STEPS);
    // 1 background + 6 step bars
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(6);
  });

  it('renders one label per step', () => {
    drawReportWaterfall(ctx, size, STEPS);
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    for (const step of STEPS) {
      expect(texts.some((t) => String(t).includes(step.label))).toBe(true);
    }
  });

  it('handles an empty step list without throwing', () => {
    expect(() => drawReportWaterfall(ctx, size, [])).not.toThrow();
  });
});
