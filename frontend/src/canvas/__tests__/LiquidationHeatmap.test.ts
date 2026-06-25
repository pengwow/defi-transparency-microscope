/**
 * Tests for the LiquidationHeatmap — 12x8 grid of risk cells.
 *
 * Pass a list of {row, col, value} cells; the chart should paint at
 * least one fillRect per cell (plus the background).
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { drawLiquidationHeatmap } from '../LiquidationHeatmap';
import type { CanvasSize } from '../types';
import { makeMockCtx } from './_helpers';

const size: CanvasSize = { width: 360, height: 240 };

describe('LiquidationHeatmap', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('paints one fillRect per cell plus the background', () => {
    const cells = Array.from({ length: 10 }, (_, i) => ({
      row: i % 8,
      col: Math.floor(i / 8),
      value: i / 10,
    }));
    drawLiquidationHeatmap(ctx, size, cells);
    // 10 cell fillRects + 1 background fillRect.
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(11);
  });

  it('clears the canvas before drawing', () => {
    drawLiquidationHeatmap(ctx, size, [{ row: 0, col: 0, value: 0.5 }]);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, size.width, size.height);
  });

  it('handles an empty cells list without throwing', () => {
    expect(() => drawLiquidationHeatmap(ctx, size, [])).not.toThrow();
  });

  it('renders a 12x8 (96 cells) full heatmap when given every cell', () => {
    const cells: { row: number; col: number; value: number }[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 12; c++) {
        cells.push({ row: r, col: c, value: Math.random() });
      }
    }
    drawLiquidationHeatmap(ctx, size, cells);
    // 96 cells + background.
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(97);
  });
});
