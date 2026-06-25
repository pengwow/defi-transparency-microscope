/**
 * Tests for chain/lending.ts — listLendingPositions returns a small
 * curated set of Aave V3 borrower positions.
 *
 * For v1 we use hard-coded sample data (the design spec says "if
 * getUserReserveData is too complex for v1, fall back to: hardcode 4
 * sample positions with realistic data; function signature still takes
 * `provider` for forward compat"). The provider argument is therefore
 * accepted but not consumed yet — tests assert the positions have
 * realistic shape and the function does NOT throw.
 */
import { describe, it, expect, vi } from 'vitest';
import { listLendingPositions } from '../../src/chain/lending.js';
import type { ChainProvider } from '../../src/chain/provider.js';

function makeProvider(): ChainProvider {
  // The current implementation doesn't actually call the provider, but
  // we hand back a fully-stubbed one so future versions can switch on
  // it without breaking tests.
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

describe('listLendingPositions', () => {
  it('returns at least 4 positions', async () => {
    const positions = await listLendingPositions(makeProvider());
    expect(positions.length).toBeGreaterThanOrEqual(4);
  });

  it('every position has the LendingPosition shape', async () => {
    const positions = await listLendingPositions(makeProvider());
    for (const p of positions) {
      expect(typeof p.id).toBe('string');
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.owner).toBe('string');
      expect(/^0x[0-9a-fA-F]{40}$/.test(p.owner)).toBe(true);
      expect(p.protocol).toBe('aave_v3');
      expect(typeof p.collateral).toBe('object');
      expect(typeof p.debt).toBe('object');
      expect(typeof p.liquidationThresholdE18).toBe('bigint');
      expect(p.liquidationThresholdE18).toBeGreaterThan(0n);
      expect(typeof p.healthFactor).toBe('number');
      expect(Number.isFinite(p.healthFactor)).toBe(true);
      expect(typeof p.timestamp).toBe('number');
    }
  });

  it('every position has a healthFactor in [0, 5]', async () => {
    const positions = await listLendingPositions(makeProvider());
    for (const p of positions) {
      expect(p.healthFactor).toBeGreaterThanOrEqual(0);
      expect(p.healthFactor).toBeLessThanOrEqual(5);
    }
  });

  it('every position has non-negative bigint collateral and debt', async () => {
    const positions = await listLendingPositions(makeProvider());
    for (const p of positions) {
      for (const v of Object.values(p.collateral)) {
        expect(typeof v).toBe('bigint');
        expect(v).toBeGreaterThanOrEqual(0n);
      }
      for (const v of Object.values(p.debt)) {
        expect(typeof v).toBe('bigint');
        expect(v).toBeGreaterThanOrEqual(0n);
      }
    }
  });

  it('positions have unique ids and unique owners', async () => {
    const positions = await listLendingPositions(makeProvider());
    const ids = new Set(positions.map((p) => p.id));
    const owners = new Set(positions.map((p) => p.owner.toLowerCase()));
    expect(ids.size).toBe(positions.length);
    expect(owners.size).toBe(positions.length);
  });

  it('at least one position is in a "risky" health-factor range (1.0..1.5)', async () => {
    const positions = await listLendingPositions(makeProvider());
    const risky = positions.filter((p) => p.healthFactor >= 1.0 && p.healthFactor <= 1.5);
    expect(risky.length).toBeGreaterThanOrEqual(1);
  });

  it('returns positions deterministically (same input → same output)', async () => {
    const a = await listLendingPositions(makeProvider());
    const b = await listLendingPositions(makeProvider());
    expect(a).toEqual(b);
  });
});
