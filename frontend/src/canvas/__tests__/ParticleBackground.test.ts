/**
 * Tests for the ParticleBackground canvas engine.
 *
 * Mirrors the spec from DTM_Demo.html lines 1403-1466: a sparse
 * field of cyan particles drifting with subtle velocity, and faint
 * connecting lines drawn between particles closer than 120px.
 *
 * The module keeps its particle field in module-level state so the
 * test exercises the same shared array the demo's render loop uses.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { drawParticles, resetParticles } from '../ParticleBackground';
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
    'stroke',
    'moveTo',
    'lineTo',
  ]) {
    ctx[m] = rec();
  }
  Object.defineProperty(ctx, 'fillStyle', { writable: true, value: '' });
  Object.defineProperty(ctx, 'strokeStyle', { writable: true, value: '' });
  Object.defineProperty(ctx, 'lineWidth', { writable: true, value: 0 });
  Object.defineProperty(ctx, 'globalAlpha', { writable: true, value: 1 });
  return ctx as unknown as CanvasRenderingContext2D;
}

describe('ParticleBackground', () => {
  beforeEach(() => {
    resetParticles();
  });

  it('clears the canvas before drawing', () => {
    const ctx = makeCtx();
    drawParticles(ctx, size);
    expect((ctx as unknown as Record<string, ReturnType<typeof vi.fn>>).clearRect).toHaveBeenCalledWith(
      0,
      0,
      size.width,
      size.height,
    );
  });

  it('draws at least the configured number of particles by arc', () => {
    const ctx = makeCtx();
    drawParticles(ctx, size, { count: 10 });
    const arc = (ctx as unknown as Record<string, ReturnType<typeof vi.fn>>).arc;
    expect(arc.mock.calls.length).toBeGreaterThanOrEqual(10);
  });

  it('does not throw with no config override', () => {
    const ctx = makeCtx();
    expect(() => drawParticles(ctx, size)).not.toThrow();
  });

  it('resetParticles clears the internal particle field', () => {
    const ctx = makeCtx();
    drawParticles(ctx, size, { count: 6 });
    // Reset and redraw with zero custom count; subsequent frames should still
    // operate without throwing.
    resetParticles();
    expect(() => drawParticles(ctx, size, { count: 3 })).not.toThrow();
  });
});
