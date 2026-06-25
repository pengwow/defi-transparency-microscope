/**
 * Tests for the ParticleSystem chart.
 *
 * Like AmmCurve, this is a context-only consumer so we can mock the
 * CanvasRenderingContext2D and verify the expected call counts and
 * payloads.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { draw, resetParticles } from '../ParticleSystem';
import type { CanvasSize } from '../types';
import type { Transaction } from '@/types';

const size: CanvasSize = { width: 320, height: 200 };

function makeTx(type: Transaction['type'], hash = '0x' + 'b'.repeat(64)): Transaction {
  return {
    hash,
    blockNumber: 1,
    timestamp: 1,
    from: '0xfrom',
    to: '0xto',
    gasUsed: 100_000n,
    gasPrice: 1n,
    type,
  };
}

function makeCtx() {
  const rec = () => vi.fn(() => undefined);
  const ctx: Record<string, unknown> = {};
  for (const m of [
    'clearRect',
    'fillRect',
    'beginPath',
    'arc',
    'fill',
    'fillText',
    'stroke',
    'moveTo',
    'lineTo',
  ]) {
    ctx[m] = rec();
  }
  Object.defineProperty(ctx, 'fillStyle', { writable: true, value: '' });
  Object.defineProperty(ctx, 'strokeStyle', { writable: true, value: '' });
  Object.defineProperty(ctx, 'font', { writable: true, value: '' });
  Object.defineProperty(ctx, 'globalAlpha', { writable: true, value: 1 });
  return ctx as unknown as CanvasRenderingContext2D;
}

describe('ParticleSystem', () => {
  let ctx: CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    ctx = makeCtx() as CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>;
    resetParticles();
  });

  it('clears the canvas before drawing', () => {
    draw(ctx, size, []);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, size.width, size.height);
  });

  it('draws at least one particle per transaction', () => {
    const txs = [makeTx('swap'), makeTx('add_liquidity'), makeTx('transfer')];
    draw(ctx, size, txs);
    // First-frame reseed creates one particle per transaction.
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(txs.length);
  });

  it('labels hot transactions with the first 6 chars of the hash', () => {
    const hotHash = '0xdeadbeef00000000000000000000000000000000000000000000000000000000';
    const txs = [makeTx('swap', hotHash), makeTx('swap', '0x' + 'c'.repeat(64))];
    draw(ctx, size, txs);
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    // At least one label is a 6-char prefix.
    expect(texts.some((t) => typeof t === 'string' && t.length === 6)).toBe(true);
  });

  it('does not throw with no transactions', () => {
    expect(() => draw(ctx, size, [])).not.toThrow();
  });
});
