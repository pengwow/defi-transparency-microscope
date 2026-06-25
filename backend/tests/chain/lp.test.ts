/**
 * Tests for chain/lp.ts — listLpPositions returns a curated set of
 * Uniswap V3 NFT LP positions.
 *
 * v1 design (per spec §7.5): use 4 hard-coded sample positions with
 * realistic data; function signature still accepts a `ChainProvider`
 * for v2 forward compat (live reads via `NonfungiblePositionManager
 * .positions(tokenId)`).
 */
import { describe, it, expect, vi } from 'vitest';
import { listLpPositions } from '../../src/chain/lp.js';
import type { ChainProvider } from '../../src/chain/provider.js';

const VALID_FEE_TIERS = new Set([500, 3000, 10000]);

function makeProvider(): ChainProvider {
  return {
    getBlockNumber: vi.fn(async () => 0x1234),
    getNetwork: vi.fn(async () => ({ chainId: 1n, name: 'mainnet' }) as never),
    getChainId: vi.fn(async () => 1),
    getBalance: vi.fn(async () => 0n),
    call: vi.fn(async () => '0x'),
    getLogs: vi.fn(async () => []),
    getBlock: vi.fn(async () => null),
    getTransaction: vi.fn(async () => null),
    send: vi.fn(async () => null),
  };
}

describe('listLpPositions', () => {
  it('returns at least 4 positions', async () => {
    const positions = await listLpPositions(makeProvider());
    expect(positions.length).toBeGreaterThanOrEqual(4);
  });

  it('every position has the LPPosition shape', async () => {
    const positions = await listLpPositions(makeProvider());
    for (const p of positions) {
      expect(typeof p.id).toBe('string');
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.owner).toBe('string');
      expect(/^0x[0-9a-fA-F]{40}$/.test(p.owner)).toBe(true);
      expect(typeof p.poolId).toBe('string');
      expect(/^0x[0-9a-fA-F]{40}$/.test(p.poolId)).toBe(true);
      expect(p.token0).toBeDefined();
      expect(p.token1).toBeDefined();
      expect(typeof p.amount0).toBe('bigint');
      expect(typeof p.amount1).toBe('bigint');
      expect(p.amount0).toBeGreaterThanOrEqual(0n);
      expect(p.amount1).toBeGreaterThanOrEqual(0n);
      expect(typeof p.tickLower).toBe('number');
      expect(typeof p.tickUpper).toBe('number');
      expect(typeof p.feeTier).toBe('number');
      expect(typeof p.apr).toBe('number');
      expect(typeof p.valueUsd).toBe('number');
      expect(typeof p.feeIncomeE18).toBe('bigint');
      expect(typeof p.impermanentLossE18).toBe('bigint');
      expect(typeof p.netPnlE18).toBe('bigint');
      expect(typeof p.timestamp).toBe('number');
    }
  });

  it('every position has tickLower < tickUpper', async () => {
    const positions = await listLpPositions(makeProvider());
    for (const p of positions) {
      expect(p.tickLower).toBeLessThan(p.tickUpper);
    }
  });

  it('every position has a feeTier in {500, 3000, 10000}', async () => {
    const positions = await listLpPositions(makeProvider());
    for (const p of positions) {
      expect(VALID_FEE_TIERS.has(p.feeTier)).toBe(true);
    }
  });

  it('positions have unique ids and unique owners', async () => {
    const positions = await listLpPositions(makeProvider());
    const ids = new Set(positions.map((p) => p.id));
    const owners = new Set(positions.map((p) => p.owner.toLowerCase()));
    expect(ids.size).toBe(positions.length);
    expect(owners.size).toBe(positions.length);
  });

  it('positions have non-negative bigint financial fields', async () => {
    const positions = await listLpPositions(makeProvider());
    for (const p of positions) {
      expect(p.feeIncomeE18).toBeGreaterThanOrEqual(0n);
      // impermanentLossE18 is stored as a non-negative magnitude; the
      // spec uses it as a "loss amount" rather than a signed delta.
      expect(p.impermanentLossE18).toBeGreaterThanOrEqual(0n);
    }
  });

  it('apr and valueUsd are finite non-negative numbers', async () => {
    const positions = await listLpPositions(makeProvider());
    for (const p of positions) {
      expect(Number.isFinite(p.apr)).toBe(true);
      expect(p.apr).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(p.valueUsd)).toBe(true);
      expect(p.valueUsd).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns positions deterministically', async () => {
    const a = await listLpPositions(makeProvider());
    const b = await listLpPositions(makeProvider());
    expect(a).toEqual(b);
  });

  it('mixes pool protocols (WETH/USDC and WETH/USDT) across positions', async () => {
    const positions = await listLpPositions(makeProvider());
    // At least one position has WETH/USDC tokens and at least one has
    // WETH/USDT tokens (verifying the curated list is not a single pool).
    const hasUsdcPair = positions.some(
      (p) =>
        (p.token0.symbol === 'USDC' || p.token1.symbol === 'USDC') &&
        (p.token0.symbol === 'WETH' || p.token1.symbol === 'WETH'),
    );
    const hasUsdtPair = positions.some(
      (p) =>
        (p.token0.symbol === 'USDT' || p.token1.symbol === 'USDT') &&
        (p.token0.symbol === 'WETH' || p.token1.symbol === 'WETH'),
    );
    expect(hasUsdcPair).toBe(true);
    expect(hasUsdtPair).toBe(true);
  });
});
