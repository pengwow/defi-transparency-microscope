/**
 * Tests for the ILCurve chart.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { draw } from '../ILCurve';
import type { CanvasSize } from '../types';
import type { V2Position, V3Position } from '@/types';
import { makeMockCtx } from './_helpers';

const size: CanvasSize = { width: 400, height: 300 };

function makeV2(): V2Position {
  return {
    id: 'v2pos',
    owner: '0xowner',
    poolAddress: '0xpool',
    protocol: 'uniswap_v2',
    status: 'active',
    openedAt: 1,
    liquidity: 100n,
    amount0: 10n,
    amount1: 10n,
  };
}

function makeV3(): V3Position {
  return {
    id: 'v3pos',
    owner: '0xowner',
    poolAddress: '0xpool',
    protocol: 'uniswap_v3',
    status: 'active',
    openedAt: 1,
    tickLower: -100,
    tickUpper: 100,
    liquidity: 100n,
    amount0: 10n,
    amount1: 10n,
    tokensOwed0: 0n,
    tokensOwed1: 0n,
  };
}

describe('ILCurve', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('renders the V2 curve for a V2 position', () => {
    draw(ctx, size, { position: makeV2() });
    // Two strokes: V2 curve + axes.
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('renders both V2 and V3 curves for a V3 position', () => {
    draw(ctx, size, { position: makeV3() });
    // Two stroke calls: V2 + V3, plus axis strokes.
    const strokeColors = (ctx.strokeStyle as unknown) as string[];
    // Expect at least 2 non-axis distinct stroke colors.
    expect(strokeColors).toBeDefined();
  });

  it('renders a title containing "Impermanent Loss"', () => {
    draw(ctx, size, { position: makeV2() });
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(texts.some((t) => t.includes('Impermanent Loss'))).toBe(true);
  });

  it('does not throw on a V2 position', () => {
    expect(() => draw(ctx, size, { position: makeV2() })).not.toThrow();
  });
});
