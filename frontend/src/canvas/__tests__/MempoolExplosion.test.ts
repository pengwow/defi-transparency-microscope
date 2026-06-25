/**
 * Tests for the MempoolExplosion canvas effect.
 *
 * Each `addExplosion(x, y, color)` schedules a burst of 12 particles
 * flying outward; `drawExplosions` clears the canvas and renders all
 * active particles.  We mock the 2D context and assert on call counts.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { addExplosion, drawExplosions, resetExplosions } from '../MempoolExplosion';
import type { CanvasSize } from '../types';

const size: CanvasSize = { width: 320, height: 200 };

function makeCtx() {
  const rec = () => vi.fn(() => undefined);
  const ctx: Record<string, unknown> = {};
  for (const m of [
    'clearRect',
    'fillRect',
    'beginPath',
    'arc',
    'fill',
    'save',
    'restore',
    'translate',
  ]) {
    ctx[m] = rec();
  }
  Object.defineProperty(ctx, 'fillStyle', { writable: true, value: '' });
  Object.defineProperty(ctx, 'globalAlpha', { writable: true, value: 1 });
  return ctx as unknown as CanvasRenderingContext2D;
}

describe('MempoolExplosion', () => {
  let ctx: CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    ctx = makeCtx() as CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>;
    resetExplosions();
  });

  it('clears the canvas on each draw call', () => {
    addExplosion(50, 50, '#ff0000');
    drawExplosions(ctx, size);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, size.width, size.height);
  });

  it('renders 12 particles per explosion (1 arc per particle)', () => {
    addExplosion(50, 50, '#ff0000');
    drawExplosions(ctx, size);
    // 12 particles, each one arc call.
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBe(12);
  });

  it('renders multiple explosions cumulatively', () => {
    addExplosion(50, 50, '#ff0000');
    addExplosion(150, 100, '#00ff00');
    drawExplosions(ctx, size);
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBe(24);
  });

  it('does nothing when no explosions have been added', () => {
    drawExplosions(ctx, size);
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it('resetExplosions clears active state', () => {
    addExplosion(10, 10, '#fff');
    resetExplosions();
    drawExplosions(ctx, size);
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});
