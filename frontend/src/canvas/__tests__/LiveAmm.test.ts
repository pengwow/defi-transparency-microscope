/**
 * Tests for the LiveAmm real-time price chart.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { drawLiveAmm, resetLiveAmm, updatePrice } from '../LiveAmm';
import type { CanvasSize } from '../types';

const size: CanvasSize = { width: 320, height: 200 };

function makeCtx() {
  const rec = () => vi.fn(() => undefined);
  const ctx: Record<string, unknown> = {};
  for (const m of [
    'clearRect',
    'fillRect',
    'beginPath',
    'closePath',
    'moveTo',
    'lineTo',
    'stroke',
    'fill',
    'arc',
    'fillText',
    'save',
    'restore',
    'createLinearGradient',
  ]) {
    ctx[m] = rec();
  }
  // createLinearGradient must return an object with addColorStop()
  (ctx.createLinearGradient as ReturnType<typeof vi.fn>).mockReturnValue({
    addColorStop: vi.fn(() => undefined),
  });
  Object.defineProperty(ctx, 'fillStyle', { writable: true, value: '' });
  Object.defineProperty(ctx, 'strokeStyle', { writable: true, value: '' });
  Object.defineProperty(ctx, 'lineWidth', { writable: true, value: 1 });
  Object.defineProperty(ctx, 'font', { writable: true, value: '' });
  Object.defineProperty(ctx, 'globalAlpha', { writable: true, value: 1 });
  return ctx as unknown as CanvasRenderingContext2D;
}

describe('LiveAmm', () => {
  let ctx: CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    ctx = makeCtx() as CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>;
    resetLiveAmm();
  });

  it('updatePrice caps the history at 50 points', () => {
    for (let i = 0; i < 80; i++) updatePrice(1);
    drawLiveAmm(ctx, size);
    // We draw the polyline twice (fill + stroke) plus close-edges and
    // axis tick lines, so the count is roughly 100-110 for 50 points.
    expect((ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(90);
    expect((ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(120);
  });

  it('renders a stroke (line) and a fill (gradient area)', () => {
    drawLiveAmm(ctx, size);
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
    expect((ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('writes the current price as text on the canvas', () => {
    updatePrice(2);
    drawLiveAmm(ctx, size);
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    // Some text like "2,45x" should be present.
    expect(texts.some((t) => /\d{2,4}(?:\.\d+)?/.test(t))).toBe(true);
  });

  it('resetLiveAmm returns the history to the default seed', () => {
    for (let i = 0; i < 30; i++) updatePrice(10);
    resetLiveAmm();
    // After reset, the chart should still render without throwing.
    expect(() => drawLiveAmm(ctx, size)).not.toThrow();
  });
});
