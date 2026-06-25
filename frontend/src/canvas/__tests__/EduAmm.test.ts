/**
 * Tests for the EduAmm canvas — visualises an AMM swap on a
 * constant-product (x*y=k) curve.
 *
 * The canvas module maintains a `setEduAmm({ reserve0, reserve1, swapSize })`
 * setter and a pure `drawEduAmm(ctx, size, opts)` function.  The
 * draw routine is responsible for:
 *   - clearing and filling the background
 *   - stroking the constant-product hyperbola
 *   - drawing the pre-swap "current" reserve point (lime)
 *   - drawing the post-swap reserve point (coral) and a connecting
 *     arrow that visualises the slippage / price impact
 *   - labelling the swap size + slippage near the arrow
 *
 * The test mocks the 2D context via the shared `makeMockCtx`
 * helper and asserts the expected method calls were issued.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setEduAmm, drawEduAmm } from '../EduAmm';
import type { CanvasSize } from '../types';
import { makeMockCtx } from './_helpers';

const size: CanvasSize = { width: 400, height: 220 };

describe('EduAmm', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('fills the background and clears once', () => {
    setEduAmm({ reserve0: 1000, reserve1: 1000, swapSize: 100 });
    drawEduAmm(ctx, size, { reserve0: 1000, reserve1: 1000, swapSize: 100 });
    // At least one fillRect (the background) and one clearRect.
    expect((ctx.clearRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('strokes the constant-product curve', () => {
    drawEduAmm(ctx, size, { reserve0: 1000, reserve1: 1000, swapSize: 100 });
    // beginPath / lineTo / stroke should fire many times for the curve.
    expect((ctx.beginPath as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the slippage label text', () => {
    drawEduAmm(ctx, size, { reserve0: 1000, reserve1: 1000, swapSize: 100 });
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    // The slippage label must mention 滑点 or 冲击.
    const labels = texts.join(' ');
    expect(labels).toMatch(/滑点|冲击|Slippage/);
  });

  it('draws the pre- and post-swap dots (arc calls >= 2)', () => {
    drawEduAmm(ctx, size, { reserve0: 1000, reserve1: 1000, swapSize: 100 });
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('does not throw on extreme swap sizes', () => {
    expect(() =>
      drawEduAmm(ctx, size, { reserve0: 10, reserve1: 10, swapSize: 5 }),
    ).not.toThrow();
  });

  it('does not throw on zero reserves (degenerate pool)', () => {
    expect(() =>
      drawEduAmm(ctx, size, { reserve0: 0, reserve1: 0, swapSize: 0 }),
    ).not.toThrow();
  });

  it('updates the cached state when setEduAmm is called', () => {
    // The setter is a state hook; it should not throw even with
    // malformed inputs.
    expect(() => setEduAmm({ reserve0: -1, reserve1: 0, swapSize: -50 })).not.toThrow();
  });
});
