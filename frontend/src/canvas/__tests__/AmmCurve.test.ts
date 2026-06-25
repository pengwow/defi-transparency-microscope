/**
 * Tests for the AmmCurve chart.
 *
 * The draw function only calls methods on the 2D context, so we can
 * verify behaviour by checking that the expected sequence of calls
 * happened (e.g. `clearRect`, `beginPath`, `arc`, `fillText`).
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { draw } from '../AmmCurve';
import type { CanvasSize } from '../types';
import type { Pool, Transaction } from '@/types';

const size: CanvasSize = { width: 400, height: 300 };

function makePool(): Pool {
  return {
    address: '0xb4e1abcdef000000000000000000000000000001',
    protocol: 'uniswap_v2',
    type: 'constant_product',
    token0: { address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'ETH', decimals: 18 },
    token1: { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', decimals: 6 },
    reserve0: 1000n * 10n ** 18n,
    reserve1: 2_000_000n * 10n ** 6n,
    fee: 3000,
    blockNumber: 18_000_000,
    timestamp: 1_700_000_000,
  };
}

function makeSwapTx(
  pool: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
): Transaction {
  return {
    hash: '0x' + 'a'.repeat(64),
    blockNumber: 1,
    timestamp: 1,
    from: '0xfrom',
    to: '0xto',
    gasUsed: 100_000n,
    gasPrice: 1n,
    type: 'swap',
    swaps: [
      { pool, tokenIn, tokenOut, amountIn, amountOut: 0n, protocol: 'uniswap_v2' },
    ],
  };
}

function makeCtx() {
  // Use a `vi.fn()` proxy so any method called on the context is recorded.
  const rec = () => vi.fn(() => undefined);
  const ctx: Record<string, unknown> = {};
  for (const m of [
    'clearRect',
    'fillRect',
    'beginPath',
    'moveTo',
    'lineTo',
    'stroke',
    'fill',
    'arc',
    'fillText',
    'save',
    'restore',
    'translate',
    'rotate',
    'scale',
  ]) {
    ctx[m] = rec();
  }
  Object.defineProperty(ctx, 'fillStyle', { writable: true, value: '' });
  Object.defineProperty(ctx, 'strokeStyle', { writable: true, value: '' });
  Object.defineProperty(ctx, 'lineWidth', { writable: true, value: 1 });
  Object.defineProperty(ctx, 'font', { writable: true, value: '' });
  Object.defineProperty(ctx, 'globalAlpha', { writable: true, value: 1 });
  return ctx as unknown as CanvasRenderingContext2D;
}

describe('AmmCurve', () => {
  let ctx: CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    ctx = makeCtx() as CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>;
  });

  it('clears and fills the canvas background', () => {
    draw(ctx, size, makePool(), []);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, size.width, size.height);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, size.width, size.height);
  });

  it('draws a curve (beginPath + stroke)', () => {
    draw(ctx, size, makePool(), []);
    // At least the hyperbola stroke and the axes stroke.
    expect((ctx.beginPath as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('plots historic swap points as arcs', () => {
    const pool = makePool();
    const tx = makeSwapTx(
      pool.address,
      pool.token0.address,
      pool.token1.address,
      10n * 10n ** 18n,
    );
    draw(ctx, size, pool, [tx]);
    // Two arcs per swap: one for the historic point, one for the current marker.
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('renders a title containing both token symbols', () => {
    const pool = makePool();
    draw(ctx, size, pool, []);
    const textArg = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(textArg).toContain('ETH');
    expect(textArg).toContain('USDC');
  });

  it('does not throw on an empty transaction list', () => {
    expect(() => draw(ctx, size, makePool(), [])).not.toThrow();
  });
});
