/**
 * Tests for the Gauge chart.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { draw } from '../Gauge';
import type { CanvasSize } from '../types';
import { makeMockCtx } from './_helpers';

const size: CanvasSize = { width: 200, height: 120 };

describe('Gauge', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('draws two arc segments (background + fill)', () => {
    draw(ctx, size, { value: 60, max: 100 });
    // Two arc calls: one for the background arc, one for the fill arc.
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('renders the value text', () => {
    draw(ctx, size, { value: 60, max: 100 });
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(texts.some((t) => t.includes('60'))).toBe(true);
  });

  it('renders the label when provided', () => {
    draw(ctx, size, { value: 60, max: 100, label: 'Health' });
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(texts).toContain('Health');
  });

  it('handles a zero value without throwing', () => {
    expect(() => draw(ctx, size, { value: 0, max: 100 })).not.toThrow();
  });
});
