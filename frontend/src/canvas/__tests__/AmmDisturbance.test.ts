/**
 * Tests for the AmmDisturbance chart — constant-product curve with
 * an attack point and attack line drawn on top.
 *
 * The renderer holds its state in a module-level object; callers
 * invoke `setDisturbance` to update it, then `drawAmmDisturbance` to
 * render the next frame.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { drawAmmDisturbance, setDisturbance, getDisturbance } from '../AmmDisturbance';
import type { CanvasSize } from '../types';
import { makeMockCtx } from './_helpers';

const size: CanvasSize = { width: 400, height: 240 };

describe('AmmDisturbance', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('exports setDisturbance and getDisturbance', () => {
    setDisturbance({ reserve0: 100, reserve1: 200, attackSize: 50, color: '#ff5e5e' });
    const s = getDisturbance();
    expect(s.reserve0).toBe(100);
    expect(s.reserve1).toBe(200);
    expect(s.attackSize).toBe(50);
    expect(s.color).toBe('#ff5e5e');
  });

  it('draws the curve and attack marker (arc + fill)', () => {
    setDisturbance({ reserve0: 1000, reserve1: 2_000_000, attackSize: 100, color: '#ff5e5e' });
    drawAmmDisturbance(ctx, size, {});
    // At least: 1 background fillRect, 1 marker arc, 1 marker fill.
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
    expect((ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('clears the canvas before drawing', () => {
    setDisturbance({ reserve0: 100, reserve1: 200, attackSize: 10, color: '#ff5e5e' });
    drawAmmDisturbance(ctx, size, {});
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, size.width, size.height);
  });

  it('draws a dashed attack line', () => {
    setDisturbance({ reserve0: 100, reserve1: 200, attackSize: 10, color: '#ff5e5e' });
    drawAmmDisturbance(ctx, size, {});
    expect(ctx.setLineDash).toHaveBeenCalled();
  });
});
