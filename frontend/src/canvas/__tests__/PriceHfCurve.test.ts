/**
 * Tests for the PriceHfCurve — HF vs ETH price line chart.
 *
 * Pass an array of {price, hf} samples; the chart should:
 *   - draw at least one stroke (the curve)
 *   - draw a dashed threshold line at HF=1
 *   - render a label for the threshold
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { drawPriceHfCurve } from '../PriceHfCurve';
import type { CanvasSize } from '../types';
import { makeMockCtx } from './_helpers';

const size: CanvasSize = { width: 400, height: 220 };

describe('PriceHfCurve', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('draws at least one stroke (curve) when given data', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      price: 1000 + i * 200,
      hf: 0.5 + (i / 9) * 1.5,
    }));
    drawPriceHfCurve(ctx, size, data);
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('draws a dashed threshold line at HF=1', () => {
    const data = [
      { price: 1000, hf: 2 },
      { price: 2000, hf: 1 },
      { price: 3000, hf: 0.5 },
    ];
    drawPriceHfCurve(ctx, size, data);
    expect(ctx.setLineDash).toHaveBeenCalled();
  });

  it('renders a label for the threshold (HF=1)', () => {
    const data = [
      { price: 1000, hf: 2 },
      { price: 2000, hf: 1 },
    ];
    drawPriceHfCurve(ctx, size, data);
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(texts.some((t) => t.includes('1'))).toBe(true);
  });

  it('handles an empty data list without throwing', () => {
    expect(() => drawPriceHfCurve(ctx, size, [])).not.toThrow();
  });
});
