/**
 * Tests for the ForkAmm canvas.
 *
 * The ForkAmm chart visualises the constant-product curve (x*y=k) along
 * with three marker dots: the pre-run state, the victim's swap, and the
 * post-run state.  Tests use the shared 2D-context mock and verify the
 * expected sequence of canvas calls (clearRect, fillRect, arc, fillText).
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  setForkAmmState,
  getForkAmmState,
  drawForkAmm,
  resetForkAmm,
} from '../ForkAmm';
import type { CanvasSize } from '../types';
import { makeMockCtx } from '../__tests__/_helpers';

const size: CanvasSize = { width: 320, height: 200 };

const DEFAULT_STATE = {
  reserve0: 1000,
  reserve1: 2000,
  depth: 1000,
  pre: { x: 800, y: 2400 },
  victim: { x: 1000, y: 2000 },
  post: { x: 1200, y: 1700 },
};

describe('ForkAmm', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  beforeEach(() => {
    ctx = makeMockCtx();
    resetForkAmm();
  });

  it('exposes a getForkAmmState that returns the default seed after reset', () => {
    resetForkAmm();
    const s = getForkAmmState();
    expect(s.reserve0).toBeGreaterThan(0);
    expect(s.reserve1).toBeGreaterThan(0);
    expect(s.depth).toBeGreaterThan(0);
  });

  it('setForkAmmState updates the state read by getForkAmmState', () => {
    setForkAmmState(DEFAULT_STATE);
    expect(getForkAmmState()).toEqual(DEFAULT_STATE);
  });

  it('clears and fills the canvas background', () => {
    drawForkAmm(ctx, size);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, size.width, size.height);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, size.width, size.height);
  });

  it('draws at least 3 arc markers (pre / victim / post)', () => {
    setForkAmmState(DEFAULT_STATE);
    drawForkAmm(ctx, size);
    // 3 marker points + a possible current marker ⇒ at least 3 arcs.
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('renders text labels for the x and y axes', () => {
    drawForkAmm(ctx, size);
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(texts.length).toBeGreaterThan(0);
  });

  it('strokes the constant-product curve', () => {
    drawForkAmm(ctx, size);
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('does not throw with the default seed', () => {
    expect(() => drawForkAmm(ctx, size)).not.toThrow();
  });
});
