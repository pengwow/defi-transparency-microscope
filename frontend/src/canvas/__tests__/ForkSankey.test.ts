/**
 * Tests for the ForkSankey canvas.
 *
 * ForkSankey takes a list of { from, to, amount, color } flows and
 * renders a left-source → right-targets distribution.  Each ribbon is
 * drawn with two quadratic bezier curves (top + bottom edges).
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { drawForkSankey } from '../ForkSankey';
import type { CanvasSize } from '../types';
import { makeMockCtx } from '../__tests__/_helpers';

const size: CanvasSize = { width: 400, height: 200 };

const FOUR_FLOWS = [
  { from: 'LP Pool', to: '策略方', amount: 1240, color: '#ff6b6b' },
  { from: 'LP Pool', to: '交易发起方', amount: 456, color: '#ffd166' },
  { from: 'LP Pool', to: 'LP 手续费', amount: 28, color: '#5bd17b' },
  { from: 'LP Pool', to: 'Validator', amount: 185, color: '#4f8cff' },
];

describe('ForkSankey', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('clears and fills the canvas background', () => {
    drawForkSankey(ctx, size, FOUR_FLOWS);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, size.width, size.height);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, size.width, size.height);
  });

  it('draws at least 4 fill calls (one source + 4 target nodes)', () => {
    drawForkSankey(ctx, size, FOUR_FLOWS);
    expect((ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('uses bezierCurveTo for ribbon edges (4 flows × 2 edges)', () => {
    drawForkSankey(ctx, size, FOUR_FLOWS);
    expect((ctx.bezierCurveTo as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('renders at least 4 labels (source + 4 targets)', () => {
    drawForkSankey(ctx, size, FOUR_FLOWS);
    expect((ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('handles an empty flow list without throwing', () => {
    expect(() => drawForkSankey(ctx, size, [])).not.toThrow();
  });
});
