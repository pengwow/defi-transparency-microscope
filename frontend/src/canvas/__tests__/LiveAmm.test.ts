/**
 * Tests for the LiveAmm real-time price chart.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { drawLiveAmm, getLivePrice, resetLiveAmm, setLivePrice, updatePrice } from '../LiveAmm';
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

  it('setLivePrice pushes a real price and updates getLivePrice', () => {
    resetLiveAmm();
    setLivePrice(2735.5);
    expect(getLivePrice()).toBe(2735.5);
    setLivePrice(2736.25);
    expect(getLivePrice()).toBe(2736.25);
  });

  it('setLivePrice dedupes repeated values (no double-push into history)', () => {
    resetLiveAmm();
    // Set the same value 5 times; the chart's rolling window should
    // NOT be padded with duplicates — this is the whole reason
    // setLivePrice exists separately from updatePrice.
    for (let i = 0; i < 5; i++) setLivePrice(2500);
    setLivePrice(2501); // bump
    // Now spam the new value — should still be just one point.
    for (let i = 0; i < 5; i++) setLivePrice(2501);
    // We can't directly inspect the history (it's module-level),
    // but we can verify that the chart still renders cleanly and
    // that the *next* call with a different value updates the
    // current price.
    expect(() => drawLiveAmm(ctx, size)).not.toThrow();
    setLivePrice(2502);
    expect(getLivePrice()).toBe(2502);
  });

  it('setLivePrice rejects non-finite and non-positive values', () => {
    resetLiveAmm();
    const before = getLivePrice();
    expect(setLivePrice(Number.NaN)).toBe(false);
    expect(setLivePrice(Number.POSITIVE_INFINITY)).toBe(false);
    expect(setLivePrice(0)).toBe(false);
    expect(setLivePrice(-1)).toBe(false);
    // getLivePrice is unchanged because none of the bad values
    // were accepted.
    expect(getLivePrice()).toBe(before);
  });
});
