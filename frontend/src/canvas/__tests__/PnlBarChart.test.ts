/**
 * Tests for the PnlBarChart 4-bar attribution chart.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { drawPnlChart } from '../PnlBarChart';
import type { CanvasSize } from '../types';

const size: CanvasSize = { width: 320, height: 160 };

function makeCtx() {
  const rec = () => vi.fn(() => undefined);
  const ctx: Record<string, unknown> = {};
  for (const m of [
    'clearRect',
    'fillRect',
    'beginPath',
    'fillText',
    'save',
    'restore',
    'translate',
    'rotate',
    'moveTo',
    'lineTo',
    'stroke',
  ]) {
    ctx[m] = rec();
  }
  Object.defineProperty(ctx, 'fillStyle', { writable: true, value: '' });
  Object.defineProperty(ctx, 'strokeStyle', { writable: true, value: '' });
  Object.defineProperty(ctx, 'font', { writable: true, value: '' });
  Object.defineProperty(ctx, 'globalAlpha', { writable: true, value: 1 });
  return ctx as unknown as CanvasRenderingContext2D;
}

describe('PnlBarChart', () => {
  let ctx: CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    ctx = makeCtx() as CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>;
  });

  it('fills 4 bars (one per data point)', () => {
    drawPnlChart(ctx, size, [
      { label: 'HODL', value: 100, color: '#69f0ae' },
      { label: 'LP', value: -30, color: '#ff5e5e' },
      { label: '手续费', value: 25, color: '#00e5ff' },
      { label: '净盈亏', value: 95, color: '#ffab40' },
    ]);
    // 4 bar fillRect calls + 1 background fill = 5.
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(5);
  });

  it('renders a value label on top of each bar', () => {
    drawPnlChart(ctx, size, [
      { label: 'a', value: 1, color: '#fff' },
      { label: 'b', value: 2, color: '#fff' },
      { label: 'c', value: 3, color: '#fff' },
      { label: 'd', value: 4, color: '#fff' },
    ]);
    // 4 value labels + possibly some axis text.
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    // The four numeric labels should each appear as fillText calls.
    expect(texts.length).toBeGreaterThanOrEqual(4);
  });

  it('handles a single-bar dataset without throwing', () => {
    expect(() =>
      drawPnlChart(ctx, size, [{ label: 'only', value: 7, color: '#fff' }]),
    ).not.toThrow();
  });

  it('renders an empty-state placeholder for no data', () => {
    drawPnlChart(ctx, size, []);
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(texts.some((t) => t.includes('no P&L'))).toBe(true);
  });
});
