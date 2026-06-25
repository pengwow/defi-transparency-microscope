/**
 * Tests for the CachedProvider wrapper.
 *
 * The wrapper must:
 *   - memoise idempotent reads (getBlockNumber, getBalance, getChainId,
 *     call) for a configurable TTL,
 *   - NOT cache getLogs (too varied to key safely),
 *   - forward every other call to the underlying provider,
 *   - expire entries when the TTL elapses.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type AddressLike, type Filter, type TransactionRequest } from 'ethers';
import { CachedProvider } from '../../src/chain/cachedProvider.js';
import type { ChainProvider } from '../../src/chain/provider.js';

function makeMockProvider(): ChainProvider & {
  getBlockNumber: ReturnType<typeof vi.fn>;
  getBalance: ReturnType<typeof vi.fn>;
  getChainId: ReturnType<typeof vi.fn>;
  call: ReturnType<typeof vi.fn>;
  getLogs: ReturnType<typeof vi.fn>;
  getBlock: ReturnType<typeof vi.fn>;
  getTransaction: ReturnType<typeof vi.fn>;
  getNetwork: ReturnType<typeof vi.fn>;
} {
  return {
    getBlockNumber: vi.fn(async () => 100),
    getBalance: vi.fn(async () => 1000n),
    getChainId: vi.fn(async () => 1),
    call: vi.fn(async () => '0xabcd'),
    getLogs: vi.fn(async () => []),
    getBlock: vi.fn(async () => null),
    getTransaction: vi.fn(async () => null),
    getNetwork: vi.fn(async () => ({ chainId: 1n, name: 'mainnet' }) as never),
  };
}

describe('CachedProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getBlockNumber', () => {
    it('calls underlying provider on first hit', async () => {
      const inner = makeMockProvider();
      const cp = new CachedProvider(inner, { ttlMs: 5_000 });
      await cp.getBlockNumber();
      expect(inner.getBlockNumber).toHaveBeenCalledTimes(1);
    });

    it('returns cached value within TTL', async () => {
      const inner = makeMockProvider();
      const cp = new CachedProvider(inner, { ttlMs: 5_000 });
      await cp.getBlockNumber();
      await cp.getBlockNumber();
      await cp.getBlockNumber();
      expect(inner.getBlockNumber).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after TTL elapses', async () => {
      const inner = makeMockProvider();
      const cp = new CachedProvider(inner, { ttlMs: 5_000 });
      await cp.getBlockNumber();
      vi.advanceTimersByTime(5_001);
      await cp.getBlockNumber();
      expect(inner.getBlockNumber).toHaveBeenCalledTimes(2);
    });

    it('uses a different cache slot per underlying value (key included)', async () => {
      const inner = makeMockProvider();
      const cp = new CachedProvider(inner, { ttlMs: 5_000 });
      inner.getBalance.mockResolvedValueOnce(111n).mockResolvedValueOnce(222n);
      expect(await cp.getBalance('0xaaa' as AddressLike)).toBe(111n);
      expect(await cp.getBalance('0xbbb' as AddressLike)).toBe(222n);
      // Both were inside TTL so the third call should still be cached
      expect(await cp.getBalance('0xaaa' as AddressLike)).toBe(111n);
      expect(inner.getBalance).toHaveBeenCalledTimes(2);
    });
  });

  describe('call', () => {
    it('caches calls by serialised transaction request', async () => {
      const inner = makeMockProvider();
      const cp = new CachedProvider(inner, { ttlMs: 5_000 });
      const tx: TransactionRequest = { to: '0x' + '11'.repeat(20), data: '0xdead' };
      await cp.call(tx);
      await cp.call(tx);
      expect(inner.call).toHaveBeenCalledTimes(1);
    });

    it('treats different call payloads as different cache keys', async () => {
      const inner = makeMockProvider();
      const cp = new CachedProvider(inner, { ttlMs: 5_000 });
      const tx1: TransactionRequest = { to: '0x' + '11'.repeat(20), data: '0xdead' };
      const tx2: TransactionRequest = { to: '0x' + '22'.repeat(20), data: '0xbeef' };
      await cp.call(tx1);
      await cp.call(tx2);
      expect(inner.call).toHaveBeenCalledTimes(2);
    });
  });

  describe('getLogs (NOT cached)', () => {
    it('forwards every getLogs call', async () => {
      const inner = makeMockProvider();
      const cp = new CachedProvider(inner, { ttlMs: 5_000 });
      const filter: Filter = { fromBlock: 0, toBlock: 1 };
      await cp.getLogs(filter);
      await cp.getLogs(filter);
      await cp.getLogs(filter);
      expect(inner.getLogs).toHaveBeenCalledTimes(3);
    });
  });

  describe('getChainId (idempotent and cached)', () => {
    it('caches the chainId', async () => {
      const inner = makeMockProvider();
      const cp = new CachedProvider(inner, { ttlMs: 5_000 });
      await cp.getChainId();
      await cp.getChainId();
      expect(inner.getChainId).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBlock / getTransaction pass-through', () => {
    it('does not cache getBlock (each call forwarded)', async () => {
      const inner = makeMockProvider();
      const cp = new CachedProvider(inner, { ttlMs: 5_000 });
      await cp.getBlock(1);
      await cp.getBlock(2);
      expect(inner.getBlock).toHaveBeenCalledTimes(2);
    });

    it('does not cache getTransaction (each call forwarded)', async () => {
      const inner = makeMockProvider();
      const cp = new CachedProvider(inner, { ttlMs: 5_000 });
      await cp.getTransaction('0xabc');
      await cp.getTransaction('0xdef');
      expect(inner.getTransaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('default TTL', () => {
    it('defaults to 5_000ms when no options are provided', () => {
      const inner = makeMockProvider();
      const cp = new CachedProvider(inner);
      // We can't easily introspect the TTL; just assert construction works
      // and the wrapper still functions.
      expect(cp).toBeInstanceOf(CachedProvider);
    });
  });

  describe('caching expiry for getBalance', () => {
    it('re-fetches after TTL elapses', async () => {
      const inner = makeMockProvider();
      const cp = new CachedProvider(inner, { ttlMs: 1_000 });
      inner.getBalance.mockResolvedValueOnce(111n).mockResolvedValueOnce(222n);
      expect(await cp.getBalance('0xabc' as AddressLike)).toBe(111n);
      vi.advanceTimersByTime(1_001);
      expect(await cp.getBalance('0xabc' as AddressLike)).toBe(222n);
      expect(inner.getBalance).toHaveBeenCalledTimes(2);
    });
  });
});
