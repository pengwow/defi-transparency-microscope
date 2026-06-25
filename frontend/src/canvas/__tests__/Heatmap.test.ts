/**
 * Tests for the Heatmap chart.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { draw } from '../Heatmap';
import type { CanvasSize } from '../types';
import { makeMockCtx } from './_helpers';

const size: CanvasSize = { width: 200, height: 100 };

describe('Heatmap', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('paints one fillRect per cell', () => {
    draw(ctx, size, [
      [1, 2, 3],
      [4, 5, 6],
    ]);
    // 2 rows * 3 cols = 6 cells, plus the background fillRect.
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(6 + 1);
  });

  it('handles a non-square matrix', () => {
    draw(ctx, size, [
      [1, 2, 3, 4, 5],
    ]);
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(5 + 1);
  });

  it('renders an empty-state message when the matrix is empty', () => {
    draw(ctx, size, []);
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(texts.some((t) => t.includes('empty'))).toBe(true);
  });

  it('handles a single row of equal values without throwing', () => {
    expect(() => draw(ctx, size, [[5, 5, 5]])).not.toThrow();
  });
});
