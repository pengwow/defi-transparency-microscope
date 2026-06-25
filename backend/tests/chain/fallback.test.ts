/**
 * Tests for the public-RPC fallback selector (`pickBestRpc`).
 *
 * We inject a `createProvider` factory so we can register deterministic
 * pass / fail / hang behaviour per URL without hitting the real network.
 */
import { describe, it, expect, vi } from 'vitest';
import type { JsonRpcProvider } from 'ethers';
import { pickBestRpc, DEFAULT_PUBLIC_RPCS } from '../../src/chain/fallback.js';

type CreateProvider = (url: string) => JsonRpcProvider;

function makeFactory(behaviours: Map<string, () => Promise<number>>): CreateProvider {
  return ((url: string) => {
    const fn = behaviours.get(url);
    return {
      getBlockNumber: vi.fn(() => (fn ? fn() : Promise.reject(new Error('no behaviour')))),
    } as unknown as JsonRpcProvider;
  }) as CreateProvider;
}

describe('pickBestRpc', () => {
  describe('input validation', () => {
    it('throws when given an empty URL list', async () => {
      const factory = makeFactory(new Map());
      await expect(pickBestRpc([], { timeoutMs: 1, createProvider: factory })).rejects.toThrow();
    });
  });

  describe('selection', () => {
    it('returns the first URL that responds successfully', async () => {
      const factory = makeFactory(
        new Map([
          ['https://rpc-a.example.com', async () => 100],
          ['https://rpc-b.example.com', async () => 200],
        ]),
      );
      const result = await pickBestRpc(
        ['https://rpc-a.example.com', 'https://rpc-b.example.com'],
        { timeoutMs: 100, createProvider: factory },
      );
      expect(result).toBe('https://rpc-a.example.com');
    });

    it('skips RPCs that throw and returns the next one that responds', async () => {
      const factory = makeFactory(
        new Map([
          ['https://rpc-bad.example.com', () => Promise.reject(new Error('fail'))],
          ['https://rpc-ok.example.com', async () => 42],
          ['https://rpc-third.example.com', async () => 99],
        ]),
      );
      const result = await pickBestRpc(
        [
          'https://rpc-bad.example.com',
          'https://rpc-ok.example.com',
          'https://rpc-third.example.com',
        ],
        { timeoutMs: 100, createProvider: factory },
      );
      expect(result).toBe('https://rpc-ok.example.com');
    });

    it('skips RPCs that time out and returns the next one that responds', async () => {
      const factory = makeFactory(
        new Map([
          // never resolves — should time out
          ['https://rpc-slow.example.com', () => new Promise<number>(() => undefined)],
          ['https://rpc-ok.example.com', async () => 7],
        ]),
      );
      const result = await pickBestRpc(
        ['https://rpc-slow.example.com', 'https://rpc-ok.example.com'],
        { timeoutMs: 50, createProvider: factory },
      );
      expect(result).toBe('https://rpc-ok.example.com');
    });

    it('throws when all RPCs fail', async () => {
      const factory = makeFactory(
        new Map([
          ['https://a.example.com', () => Promise.reject(new Error('down'))],
          ['https://b.example.com', () => Promise.reject(new Error('down'))],
        ]),
      );
      await expect(
        pickBestRpc(['https://a.example.com', 'https://b.example.com'], {
          timeoutMs: 50,
          createProvider: factory,
        }),
      ).rejects.toThrow();
    });

    it('throws when all RPCs time out', async () => {
      const factory = makeFactory(
        new Map([
          ['https://a.example.com', () => new Promise<number>(() => undefined)],
          ['https://b.example.com', () => new Promise<number>(() => undefined)],
        ]),
      );
      await expect(
        pickBestRpc(['https://a.example.com', 'https://b.example.com'], {
          timeoutMs: 20,
          createProvider: factory,
        }),
      ).rejects.toThrow();
    });

    it('tries the URLs in order', async () => {
      const tried: string[] = [];
      const factory = makeFactory(
        new Map([
          ['https://a.example.com', async () => 1],
          ['https://b.example.com', async () => 2],
        ]),
      );
      // Wrap factory to record order
      const wrapped: CreateProvider = ((url: string) => {
        tried.push(url);
        return factory(url);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;
      await pickBestRpc(['https://a.example.com', 'https://b.example.com'], {
        timeoutMs: 50,
        createProvider: wrapped,
      });
      expect(tried[0]).toBe('https://a.example.com');
    });
  });

  describe('defaults', () => {
    it('exports DEFAULT_PUBLIC_RPCS matching the spec', () => {
      expect(DEFAULT_PUBLIC_RPCS).toEqual([
        'https://eth.llamarpc.com',
        'https://cloudflare-eth.com',
        'https://rpc.ankr.com/eth',
      ]);
    });
  });
});
