/**
 * Tests for the HFChart time-series.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { draw } from '../HFChart';
import type { CanvasSize } from '../types';
import type { LendingPosition } from '@/types';
import { makeMockCtx } from './_helpers';

const size: CanvasSize = { width: 400, height: 200 };

function makeLending(over: Partial<LendingPosition> = {}): LendingPosition {
  return {
    id: 'lp1',
    owner: '0xowner',
    protocol: 'aave',
    collateral: { '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 10n * 10n ** 18n },
    debt: { '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 5_000n * 10n ** 6n },
    liquidationThresholdE18: 800000000000000000n,
    timestamp: 1,
    ...over,
  };
}

describe('HFChart', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('draws one polyline per position (beginPath + stroke)', () => {
    draw(ctx, size, {
      positions: [makeLending(), makeLending({ id: 'lp2' })],
      threshold: 1.5,
    });
    expect((ctx.beginPath as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(3);
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('draws the threshold line as a dashed line', () => {
    draw(ctx, size, { positions: [makeLending()], threshold: 1.5 });
    expect(ctx.setLineDash).toHaveBeenCalled();
  });

  it('renders the threshold label', () => {
    draw(ctx, size, { positions: [makeLending()], threshold: 1.5 });
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(texts.some((t) => t.includes('1.50'))).toBe(true);
  });

  it('uses the provided samples when given', () => {
    draw(ctx, size, {
      positions: [makeLending()],
      threshold: 1.0,
      samples: [[1.0, 1.2, 1.5, 2.0, 1.5]],
    });
    expect((ctx.beginPath as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
